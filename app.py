from flask import Flask, render_template, request, jsonify, flash, redirect, url_for
import oracledb
import os
from datetime import datetime, timedelta
import json
import threading
import time

app = Flask(__name__)
app.secret_key = 'kutuphane_otomasyon_2024'

# Oracle bağlantı bilgileri
ORACLE_HOST = "localhost"
ORACLE_PORT = "1521"
ORACLE_SID = "xe"
ORACLE_USER = "AT_KUTUPHANE"
ORACLE_PASSWORD = "123456"

# Bağlantı havuzu (Connection Pool)
pool = None
pool_lock = threading.Lock()

def init_connection_pool():
    """Oracle bağlantı havuzunu başlat"""
    global pool
    try:
        # oracledb connection pool oluştur
        pool = oracledb.create_pool(
            user=ORACLE_USER,
            password=ORACLE_PASSWORD,
            dsn=f"{ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SID}",
            min=2,  # Minimum bağlantı sayısı
            max=8,  # Maximum bağlantı sayısı
            increment=1
        )
        print("✅ Oracle bağlantı havuzu başarıyla oluşturuldu")
        return True
    except oracledb.DatabaseError as e:
        print(f"❌ Oracle bağlantı havuzu oluşturulamadı: {e}")
        return False

def get_db_connection():
    """Havuzdan bağlantı al"""
    global pool
    with pool_lock:
        if pool is None:
            if not init_connection_pool():
                raise Exception("Veritabanı bağlantı havuzu oluşturulamadı")
    
    try:
        return pool.acquire()
    except oracledb.DatabaseError as e:
        print(f"❌ Bağlantı havuzundan bağlantı alınamadı: {e}")
        raise

def execute_query(query, params=None, fetch_all=True):
    """Optimized query execution with connection pooling"""
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        
        if fetch_all:
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
        else:
            connection.commit()
            return cursor.rowcount
            
    except oracledb.DatabaseError as e:
        if connection:
            connection.rollback()
        print(f"❌ Veritabanı hatası: {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if connection:
            pool.release(connection)

def execute_procedure(proc_name, params):
    """Stored procedure execution with connection pooling"""
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Procedure çağır
        result = cursor.callproc(proc_name, params)
        connection.commit()
        return result
        
    except oracledb.DatabaseError as e:
        if connection:
            connection.rollback()
        print(f"❌ Procedure hatası ({proc_name}): {e}")
        raise
    finally:
        if cursor:
            cursor.close()
        if connection:
            pool.release(connection)

# Cache için optimize edilmiş decorator
def cache_response(timeout=30):
    """Response cache decorator"""
    def decorator(f):
        def decorated_function(*args, **kwargs):
            response = f(*args, **kwargs)
            if hasattr(response, 'headers'):
                response.headers['Cache-Control'] = f'public, max-age={timeout}'
                response.headers['Expires'] = datetime.now().strftime('%a, %d %b %Y %H:%M:%S GMT')
                response.headers['Vary'] = 'Accept-Encoding'
            return response
        decorated_function.__name__ = f.__name__
        return decorated_function
    return decorator

@app.route('/')
def index():
    """Ana sayfa"""
    return render_template('index.html')

@app.route('/api/uyeler')
@cache_response(30)
def get_uyeler():
    """Tüm üyeleri getir"""
    try:
        query = "SELECT UYE_ID, AD, SOYAD, KAYIT_TARIHI FROM AT_UYELER ORDER BY UYE_ID DESC"
        uyeler = execute_query(query)
        
        # Tarih formatını düzenle
        for uye in uyeler:
            if uye['KAYIT_TARIHI']:
                uye['KAYIT_TARIHI'] = uye['KAYIT_TARIHI'].strftime('%Y-%m-%d')
        
        return jsonify(uyeler)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/kitaplar')
@cache_response(30)
def get_kitaplar():
    """Tüm kitapları getir"""
    try:
        query = "SELECT KITAP_ID, KITAP_ADI, YAZAR, STOK_ADET FROM AT_KITAPLAR ORDER BY KITAP_ID DESC"
        kitaplar = execute_query(query)
        return jsonify(kitaplar)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/odunc_listesi')
@cache_response(15)  # Daha kısa cache süresi
def get_odunc_listesi():
    """Ödünç alınan kitapları getir"""
    try:
        query = """SELECT ODUNC_ID, UYE_ID, KITAP_ID, 
                          TO_CHAR(ALIS_TARIHI, 'YYYY-MM-DD') as ALIS_TARIHI,
                          TO_CHAR(IADE_TARIHI, 'YYYY-MM-DD') as IADE_TARIHI,
                          TESLIM_EDILDI_MI 
                   FROM AT_ODUNC 
                   ORDER BY ODUNC_ID DESC"""
        odunc_listesi = execute_query(query)
        return jsonify(odunc_listesi)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gec_iade_log')
@cache_response(60)  # Daha uzun cache süresi
def get_gec_iade_log():
    """Geç iade loglarını getir"""
    try:
        query = """SELECT LOG_ID, ODUNC_ID, 
                          TO_CHAR(GEC_IADE_TARIHI, 'YYYY-MM-DD') as GEC_IADE_TARIHI
                   FROM AT_GEC_IADE_LOG 
                   ORDER BY LOG_ID DESC"""
        log_listesi = execute_query(query)
        return jsonify(log_listesi)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/uye_ekle', methods=['POST'])
def uye_ekle():
    """Yeni üye ekle"""
    try:
        data = request.get_json()
        
        # Server-side validation (güvenlik için kritik)
        ad = data.get('ad', '').strip() if data.get('ad') else ''
        soyad = data.get('soyad', '').strip() if data.get('soyad') else ''
        
        if not ad or not soyad:
            return jsonify({'success': False, 'error': 'Ad ve soyad boş olamaz'}), 400
        
        if len(ad) > 50 or len(soyad) > 50:
            return jsonify({'success': False, 'error': 'Ad ve soyad 50 karakterden uzun olamaz'}), 400
        
        # Stored procedure yerine direct insert kullan (daha uyumlu)
        query = "INSERT INTO AT_UYELER (AD, SOYAD, KAYIT_TARIHI) VALUES (:ad, :soyad, SYSDATE)"
        execute_query(query, {'ad': ad, 'soyad': soyad}, fetch_all=False)
        
        return jsonify({
            'success': True, 
            'message': f'{ad} {soyad} başarıyla üye olarak eklendi'
        })
    except oracledb.IntegrityError:
        return jsonify({'success': False, 'error': 'Bu üye zaten mevcut'}), 400
    except oracledb.DatabaseError as e:
        error_msg = str(e).lower()
        if 'unique constraint' in error_msg:
            return jsonify({'success': False, 'error': 'Bu üye zaten kayıtlı'}), 400
        return jsonify({'success': False, 'error': 'Veritabanı hatası oluştu'}), 500
    except Exception as e:
        print(f"Üye ekleme hatası: {e}")
        return jsonify({'success': False, 'error': 'Sistemde bir hata oluştu'}), 500

@app.route('/api/kitap_ekle', methods=['POST'])
def kitap_ekle():
    """Yeni kitap ekle veya mevcut kitabın stokunu artır"""
    try:
        data = request.get_json()
        
        # Server-side validation
        kitap_adi = data.get('kitap_adi', '').strip() if data.get('kitap_adi') else ''
        yazar = data.get('yazar', '').strip() if data.get('yazar') else ''
        stok_adedi = data.get('stok_adedi')
        
        if not kitap_adi or not yazar:
            return jsonify({'success': False, 'error': 'Kitap adı ve yazar boş olamaz'}), 400
        
        if len(kitap_adi) > 100 or len(yazar) > 100:
            return jsonify({'success': False, 'error': 'Kitap adı ve yazar 100 karakterden uzun olamaz'}), 400
        
        try:
            stok_adedi = int(stok_adedi)
            if stok_adedi <= 0 or stok_adedi > 1000:
                return jsonify({'success': False, 'error': 'Stok adedi 1-1000 arasında olmalıdır'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Geçersiz stok adedi'}), 400
        
        # Güçlendirilmiş kitap kontrolü - TRIM ve UPPER ile
        check_query = """SELECT KITAP_ID, STOK_ADET, KITAP_ADI, YAZAR 
                        FROM AT_KITAPLAR 
                        WHERE TRIM(UPPER(KITAP_ADI)) = TRIM(UPPER(:kitap_adi)) 
                        AND TRIM(UPPER(YAZAR)) = TRIM(UPPER(:yazar))"""
        existing = execute_query(check_query, {'kitap_adi': kitap_adi, 'yazar': yazar})
        
        if existing:
            # Mevcut kitabın stokunu güncelle
            existing_record = existing[0]
            update_query = "UPDATE AT_KITAPLAR SET STOK_ADET = STOK_ADET + :stok WHERE KITAP_ID = :id"
            execute_query(update_query, {'stok': stok_adedi, 'id': existing_record['KITAP_ID']}, fetch_all=False)
            
            # Yeni toplam stok
            new_total = existing_record['STOK_ADET'] + stok_adedi
            message = f"'{existing_record['KITAP_ADI']}' kitabının stoku {stok_adedi} adet artırıldı (Toplam: {new_total} adet)"
        else:
            # Yeni kitap ekle
            insert_query = "INSERT INTO AT_KITAPLAR (KITAP_ADI, YAZAR, STOK_ADET) VALUES (:kitap_adi, :yazar, :stok_adet)"
            execute_query(insert_query, {'kitap_adi': kitap_adi, 'yazar': yazar, 'stok_adet': stok_adedi}, fetch_all=False)
            message = f"'{kitap_adi}' kitabı başarıyla eklendi ({stok_adedi} adet)"
        
        return jsonify({
            'success': True, 
            'message': message
        })
    except oracledb.DatabaseError as e:
        print(f"Kitap ekleme DB hatası: {e}")
        return jsonify({'success': False, 'error': 'Veritabanı hatası oluştu'}), 500
    except Exception as e:
        print(f"Kitap ekleme hatası: {e}")
        return jsonify({'success': False, 'error': 'Sistemde bir hata oluştu'}), 500

@app.route('/api/kitap_odunc_ver', methods=['POST'])
def kitap_odunc_ver():
    """Kitap ödünç ver"""
    try:
        data = request.get_json()
        
        # Server-side validation
        try:
            uye_id = int(data.get('uye_id', 0))
            kitap_id = int(data.get('kitap_id', 0))
            
            if uye_id <= 0 or kitap_id <= 0:
                return jsonify({'success': False, 'error': 'Geçersiz ID değerleri'}), 400
                
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Geçersiz ID değerleri'}), 400
        
        # Üye var mı kontrol et
        uye_check = execute_query("SELECT UYE_ID FROM AT_UYELER WHERE UYE_ID = :id", {'id': uye_id})
        if not uye_check:
            return jsonify({'success': False, 'error': 'Belirtilen üye bulunamadı'}), 404
        
        # Kitap var mı ve stokta mı kontrol et
        kitap_check = execute_query("SELECT STOK_ADET FROM AT_KITAPLAR WHERE KITAP_ID = :id", {'id': kitap_id})
        if not kitap_check:
            return jsonify({'success': False, 'error': 'Belirtilen kitap bulunamadı'}), 404
        
        if kitap_check[0]['STOK_ADET'] <= 0:
            return jsonify({'success': False, 'error': 'Kitap stokta yok'}), 400
        
        # Ödünç kayıt ekle
        insert_query = """INSERT INTO AT_ODUNC (UYE_ID, KITAP_ID, ALIS_TARIHI, TESLIM_EDILDI_MI) 
                         VALUES (:uye_id, :kitap_id, SYSDATE, 'H')"""
        execute_query(insert_query, {'uye_id': uye_id, 'kitap_id': kitap_id}, fetch_all=False)
        
        # Stok azalt
        update_query = "UPDATE AT_KITAPLAR SET STOK_ADET = STOK_ADET - 1 WHERE KITAP_ID = :id"
        execute_query(update_query, {'id': kitap_id}, fetch_all=False)
        
        return jsonify({
            'success': True, 
            'message': f'Kitap başarıyla ödünç verildi'
        })
    except oracledb.DatabaseError as e:
        print(f"Ödünç verme DB hatası: {e}")
        return jsonify({'success': False, 'error': 'Ödünç işlemi gerçekleştirilemedi'}), 500
    except Exception as e:
        print(f"Ödünç verme hatası: {e}")
        return jsonify({'success': False, 'error': 'Sistemde bir hata oluştu'}), 500

@app.route('/api/kitap_iade', methods=['POST'])
def kitap_iade():
    """Kitap iade al"""
    try:
        data = request.get_json()
        
        # Server-side validation
        try:
            odunc_id = int(data.get('odunc_id', 0))
            if odunc_id <= 0:
                return jsonify({'success': False, 'error': 'Geçersiz ödünç ID'}), 400
        except (ValueError, TypeError):
            return jsonify({'success': False, 'error': 'Geçersiz ödünç ID'}), 400
        
        # Ödünç kaydı var mı kontrol et
        odunc_check = execute_query("""SELECT o.KITAP_ID, o.TESLIM_EDILDI_MI, o.ALIS_TARIHI 
                                       FROM AT_ODUNC o WHERE o.ODUNC_ID = :id""", {'id': odunc_id})
        if not odunc_check:
            return jsonify({'success': False, 'error': 'Belirtilen ödünç kaydı bulunamadı'}), 404
        
        if odunc_check[0]['TESLIM_EDILDI_MI'] == 'E':
            return jsonify({'success': False, 'error': 'Bu kitap zaten iade edilmiş'}), 400
        
        # Geç iade kontrolü
        alis_tarihi = odunc_check[0]['ALIS_TARIHI']
        gun_farki = (datetime.now() - alis_tarihi).days
        
        # İade kayıt güncelle
        update_query = "UPDATE AT_ODUNC SET IADE_TARIHI = SYSDATE, TESLIM_EDILDI_MI = 'E' WHERE ODUNC_ID = :id"
        execute_query(update_query, {'id': odunc_id}, fetch_all=False)
        
        # Stok artır
        kitap_id = odunc_check[0]['KITAP_ID']
        update_stok = "UPDATE AT_KITAPLAR SET STOK_ADET = STOK_ADET + 1 WHERE KITAP_ID = :id"
        execute_query(update_stok, {'id': kitap_id}, fetch_all=False)
        
        # Geç iade ise log kaydet (15 günden fazla)
        if gun_farki > 15:
            log_query = "INSERT INTO AT_GEC_IADE_LOG (ODUNC_ID, GEC_IADE_TARIHI) VALUES (:odunc_id, SYSDATE)"
            execute_query(log_query, {'odunc_id': odunc_id}, fetch_all=False)
        
        return jsonify({
            'success': True, 
            'message': f'Kitap başarıyla iade alındı'
        })
    except oracledb.DatabaseError as e:
        print(f"İade DB hatası: {e}")
        return jsonify({'success': False, 'error': 'İade işlemi gerçekleştirilemedi'}), 500
    except Exception as e:
        print(f"İade hatası: {e}")
        return jsonify({'success': False, 'error': 'Sistemde bir hata oluştu'}), 500

# Yardımcı API'ler - Optimize edilmiş
@app.route('/api/uye_kitap_sayisi/<int:uye_id>')
@cache_response(60)
def uye_kitap_sayisi(uye_id):
    """Üyenin elindeki kitap sayısını getir"""
    try:
        if uye_id <= 0:
            return jsonify({'error': 'Geçersiz üye ID'}), 400
            
        query = """SELECT COUNT(*) as KITAP_SAYISI 
                   FROM AT_ODUNC 
                   WHERE UYE_ID = :uye_id AND TESLIM_EDILDI_MI = 'H'"""
        result = execute_query(query, {'uye_id': uye_id})
        
        if result:
            return jsonify({'kitap_sayisi': result[0]['KITAP_SAYISI']})
        else:
            return jsonify({'kitap_sayisi': 0})
    except Exception as e:
        print(f"Üye kitap sayısı hatası: {e}")
        return jsonify({'error': 'Üye bilgisi alınamadı'}), 500

@app.route('/api/stok_sorgula/<int:kitap_id>')
@cache_response(30)
def stok_sorgula(kitap_id):
    """Kitap stok durumunu sorgula"""
    try:
        if kitap_id <= 0:
            return jsonify({'error': 'Geçersiz kitap ID'}), 400
            
        query = "SELECT STOK_ADET as STOK FROM AT_KITAPLAR WHERE KITAP_ID = :kitap_id"
        result = execute_query(query, {'kitap_id': kitap_id})
        
        if result:
            return jsonify({'stok': result[0]['STOK']})
        else:
            return jsonify({'error': 'Kitap bulunamadı'}), 404
    except Exception as e:
        print(f"Stok sorgulama hatası: {e}")
        return jsonify({'error': 'Stok bilgisi alınamadı'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint bulunamadı'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Sunucu hatası'}), 500

@app.errorhandler(400)
def bad_request(error):
    return jsonify({'error': 'Geçersiz istek'}), 400

# Graceful shutdown
import atexit

def cleanup():
    """Uygulama kapanırken temizlik yap"""
    global pool
    if pool:
        try:
            pool.close()
            print("🔌 Bağlantı havuzu kapatıldı")
        except:
            pass

atexit.register(cleanup)

if __name__ == '__main__':
    # Uygulama başlarken bağlantı havuzunu başlat
    print("🚀 AT Kütüphane Otomasyon Sistemi başlatılıyor...")
    if init_connection_pool():
        print("📚 Sistem hazır!")
        app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
    else:
        print("❌ Sistem başlatılamadı. Oracle bağlantısını kontrol edin.") 