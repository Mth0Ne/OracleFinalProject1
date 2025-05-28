# AT Kütüphane Otomasyon Sistemi - Web Arayüzü 📚

Bu proje, Oracle PL/SQL ile geliştirilmiş AT_KUTUPHANE kütüphane otomasyon sisteminin modern web arayüzüdür. Flask Python framework'ü kullanılarak geliştirilmiştir.

## 🌟 Özellikler

### Tüm AT_ Procedure'leri ve Function'ları Web'de:
- ✅ **AT_UYE_EKLE** - Yeni üye ekleme
- ✅ **AT_KITAP_EKLE** - Yeni kitap ekleme
- ✅ **AT_KITAP_ODUNC_VER** - Kitap ödünç verme
- ✅ **AT_KITAP_IADE** - Kitap iade alma
- ✅ **AT_UYE_KITAP_SAYISI** - Üyenin elindeki kitap sayısı
- ✅ **AT_STOK_SORGULA** - Kitap stok durumu sorgulama

### Modern Web Arayüzü:
- 📱 Responsive tasarım (mobil uyumlu)
- 🎨 Modern Bootstrap UI
- 🔄 Gerçek zamanlı veri güncellemeleri
- 📊 Dinamik tablolar ve grafikler
- ⚡ AJAX ile hızlı işlemler

## 🚀 Hızlı Başlangıç

### 1. Gereksinimler
```bash
- Python 3.8+
- Oracle Database (XE/SE/EE)
- Oracle Instant Client
- AT_KUTUPHANE user schema (daha önce oluşturulmuş olmalı)
```

### 2. Python Paketlerini Yükle
```bash
pip install -r requirements.txt
```

### 3. Oracle Client Kurulumu (Ubuntu/Debian)
```bash
# Oracle Instant Client indirin ve kurun
sudo apt update
sudo apt install libaio1
wget https://download.oracle.com/otn_software/linux/instantclient/1921000/instantclient-basic-linux.x64-19.21.0.0.0dbru.zip
# İndirdiğiniz dosyayı /opt/oracle/ klasörüne açın
```

### 4. Veritabanı Bağlantı Ayarları
`app.py` dosyasında bağlantı bilgilerini kontrol edin:
```python
DB_CONFIG = {
    'user': 'AT_KUTUPHANE',      # Oracle kullanıcı adınız
    'password': '123456',   # Oracle şifreniz
    'dsn': 'localhost:1521/XE'    # Oracle bağlantı string'i
}
```

### 5. Uygulamayı Başlatın
```bash
python app.py
```

### 6. Tarayıcıda Açın
```
http://localhost:5000
```

## 🖥️ Kullanım Kılavuzu

### Ana Ekran Bölümleri:

#### 🟢 Sol Panel - İşlem Formları:
1. **Üye İşlemleri** - Yeni üye ekleme formu
2. **Kitap İşlemleri** - Yeni kitap ekleme formu
3. **Ödünç İşlemleri** - Kitap verme/alma işlemleri
4. **Sorgulama** - Function'ları test etme

#### 🟦 Sağ Panel - Veri Görüntüleme:
1. **Üyeler** - AT_UYELER tablosu
2. **Kitaplar** - AT_KITAPLAR tablosu
3. **Ödünç Listesi** - AT_ODUNC tablosu
4. **Geç İade Log** - AT_GEC_IADE_LOG tablosu

### İşlem Örnekleri:

#### Yeni Üye Ekleme:
1. Sol panelde "Üye İşlemleri" bölümünü bulun
2. Ad Soyad, Telefon, Email, Adres bilgilerini girin
3. "Üye Ekle" butonuna tıklayın
4. ✅ AT_UYE_EKLE procedure'ü çalışır

#### Kitap Ödünç Verme:
1. "Ödünç İşlemleri" bölümünde Üye ID ve Kitap ID girin
2. "Ödünç Ver" butonuna tıklayın
3. ✅ AT_KITAP_ODUNC_VER procedure'ü çalışır
4. 🔄 Stok otomatik güncellenir (trigger ile)

#### Function Sorgulama:
1. "Sorgulama" bölümünde Üye ID girin
2. "Kitap Sayısı" butonuna tıklayın
3. ✅ AT_UYE_KITAP_SAYISI function'ı çalışır

## 🔧 Teknik Detaylar

### Kullanılan Teknolojiler:
- **Backend:** Flask (Python)
- **Database:** Oracle cx_Oracle driver
- **Frontend:** HTML5, CSS3, Bootstrap 5
- **JavaScript:** Modern ES6+, AJAX
- **Icons:** Font Awesome

### API Endpoints:
```
GET  /                     # Ana sayfa
GET  /api/uyeler          # Üye listesi
GET  /api/kitaplar        # Kitap listesi
GET  /api/odunc_listesi   # Ödünç listesi
GET  /api/gec_iade_log    # Geç iade logları
POST /api/uye_ekle        # Yeni üye ekleme
POST /api/kitap_ekle      # Yeni kitap ekleme
POST /api/kitap_odunc_ver # Kitap ödünç verme
POST /api/kitap_iade      # Kitap iade alma
GET  /api/uye_kitap_sayisi/<id>  # Üye kitap sayısı
GET  /api/stok_sorgula/<id>      # Stok sorgulama
```

### Dosya Yapısı:
```
📁 OracleFinalProject/
├── 📄 app.py                 # Flask uygulaması
├── 📄 requirements.txt       # Python bağımlılıkları
├── 📄 Web_README.md          # Bu dosya
├── 📁 templates/
│   └── 📄 index.html        # Ana sayfa HTML
├── 📁 static/
│   ├── 📁 css/
│   │   └── 📄 style.css     # CSS stilleri
│   └── 📁 js/
│       └── 📄 main.js       # JavaScript
└── 📁 Oracle SQL Files/
    ├── 📄 1_Yeni_Kullanici_Olustur.sql
    ├── 📄 2_Ana_Sistem.sql
    └── 📄 3_Test_Ornekleri.sql
```

## 🎯 Sunum İçin Kullanım

### Demo Senaryosu:
1. **Sistem Tanıtımı** - Ana sayfa üzerinden özellikler
2. **Üye Ekleme** - Canlı olarak yeni üye ekleme
3. **Kitap Ekleme** - Yeni kitap ekleme ve stok güncelleme
4. **Ödünç İşlemi** - Kitap verme ve trigger çalışması
5. **Sorgulama** - Function'ları test etme
6. **İade İşlemi** - Kitap iade alma
7. **Loglar** - Geç iade loglarını görüntüleme

### Gösterilecek Özellikler:
- ✅ Tüm AT_ procedure'leri çalışıyor
- ✅ Function'lar gerçek zamanlı sonuç veriyor
- ✅ Trigger'lar otomatik çalışıyor
- ✅ İş kuralları uygulanıyor (7 gün bekleme, 15 gün iade)
- ✅ Modern web arayüzü

## 🐛 Sorun Giderme

### Veritabanı Bağlantı Hatası:
```bash
# Oracle Instant Client yolunu kontrol edin
export LD_LIBRARY_PATH=/opt/oracle/instantclient_19_21:$LD_LIBRARY_PATH

# Veritabanının çalıştığını kontrol edin
sqlplus AT_KUTUPHANE/123456@localhost:1521/XE
```

### Python Modül Hatası:
```bash
# Sanal ortam oluşturun
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Paketleri yükleyin
pip install -r requirements.txt
```

### Port Conflict:
```bash
# Farklı port kullanın
python app.py --port 8080
```

## 🏆 Başarı Göstergeleri

Bu web uygulaması ile başarıyla gösterebileceğiniz özellikler:

✅ **Procedure Entegrasyonu** - Tüm AT_ procedure'leri web'de çalışıyor
✅ **Function Kullanımı** - Oracle function'ları web'den çağrılabiliyor
✅ **Trigger İzleme** - Otomatik işlemler web'de görülebiliyor
✅ **İş Kuralları** - Oracle'daki iş mantığı web'de uygulanıyor
✅ **Modern Arayüz** - Profesyonel görünüm
✅ **Gerçek Zamanlı** - Anında veri güncellemeleri

## 📞 İletişim

Proje: AT Kütüphane Otomasyon Sistemi
Geliştirici: [Adınız]
Tarih: 2024

**Sunum için hazır! 🚀** 