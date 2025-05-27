# Kütüphane Otomasyon Sistemi

**Temiz Kurulum Rehberi**

Bu sistem, Oracle PL/SQL kullanılarak geliştirilmiş kapsamlı bir kütüphane otomasyon sistemidir. Tüm veritabanı nesneleri AT_ prefix'i ile özelleştirilmiştir ve ayrı bir kullanıcı schema'sında çalışır.

## 🚀 TEMİZ KURULUM SÜRECİ

### Adım 1: Yeni Kullanıcı Oluşturma

```sql
-- SYSTEM veya DBA kullanıcısı ile çalıştırın
@1_Yeni_Kullanici_Olustur.sql
```

**Bu adım:**
- `AT_KUTUPHANE` kullanıcısını oluşturur
- Şifre: `Kutuphane123!`
- Gerekli tüm yetkileri verir

### Adım 2: Ana Sistem Kurulumu

```sql
-- AT_KUTUPHANE kullanıcısı ile bağlanın ve çalıştırın
@2_Ana_Sistem.sql
```

**Bu adım:**
- 4 Tablo oluşturur
- 2 Fonksiyon oluşturur
- 4 Prosedür oluşturur
- 3 Trigger oluşturur
- 1 View oluşturur
- Temel test verilerini ekler

### Adım 3: Test Örnekleri

```sql
-- AT_KUTUPHANE kullanıcısı ile çalıştırın
@3_Test_Ornekleri.sql
```

**Bu adım:**
- Kapsamlı testleri çalıştırır
- Hata durumlarını test eder
- Raporları gösterir
- Sistemin çalıştığını doğrular

## 📋 Sistem Özellikleri

### 🗂️ Tablolar
- `AT_UYELER` - Üye bilgileri
- `AT_KITAPLAR` - Kitap bilgileri ve stok
- `AT_ODUNC` - Ödünç alma kayıtları
- `AT_GEC_IADE_LOG` - Geç iade log tablosu

### 🔧 Prosedürler
- `AT_YENI_UYE_EKLE` - Yeni üye ekleme
- `AT_YENI_KITAP_EKLE` - Yeni kitap ekleme
- `AT_KITAP_ODUNC_VER` - Kitap ödünç verme
- `AT_KITAP_IADE_ET` - Kitap iade etme

### 📊 Fonksiyonlar
- `AT_UYE_KITAP_SAYISI` - Üyenin toplam kitap sayısı
- `AT_KITAP_STOK_SORGULA` - Kitap stok sorgulama

### ⚡ Trigger'lar
- `AT_TRG_STOK_AZALT` - Otomatik stok azaltma
- `AT_TRG_STOK_ARTTIR` - Otomatik stok arttırma
- `AT_TRG_GEC_IADE_LOG` - Geç iade log kaydı

## 🎯 Önemli Kurallar

### 🕐 7 Günlük Bekleme Kuralı
Bir üye, aynı kitabı tekrar alabilmesi için önceki iadeden itibaren **en az 7 gün** beklemesi gerekir.

### ⏰ 15 Günlük İade Süresi
Kitaplar **15 gün** içinde iade edilmelidir. Bu süreden sonra:
- İade sırasında uyarı mesajı gösterilir
- `AT_GEC_IADE_LOG` tablosuna otomatik kayıt düşer

### 🔄 Otomatik Stok Yönetimi
- Kitap ödünç alındığında stok otomatik azalır
- Kitap iade edildiğinde stok otomatik artar

## 📝 Hızlı Test Örnekleri

```sql
-- DBMS_OUTPUT etkinleştir
SET SERVEROUTPUT ON;

-- Yeni üye ekle
BEGIN
    AT_YENI_UYE_EKLE('Test', 'Kullanıcı');
END;
/

-- Yeni kitap ekle
BEGIN
    AT_YENI_KITAP_EKLE('Test Kitap', 'Test Yazar', 5);
END;
/

-- Kitap ödünç ver
BEGIN
    AT_KITAP_ODUNC_VER(1, 1);
END;
/

-- Sistem durumunu görüntüle
SELECT * FROM AT_SISTEM_DURUMU;
```

## 🔍 Sorgulama Örnekleri

```sql
-- Tüm üyeleri listele
SELECT * FROM AT_UYELER;

-- Aktif ödünç kayıtları
SELECT 
    o.ODUNC_ID,
    u.AD || ' ' || u.SOYAD AS UYE_ADI,
    k.KITAP_ADI,
    o.ALIS_TARIHI
FROM AT_ODUNC o
JOIN AT_UYELER u ON o.UYE_ID = u.UYE_ID
JOIN AT_KITAPLAR k ON o.KITAP_ID = k.KITAP_ID
WHERE o.TESLIM_EDILDI_MI = 'N';

-- Stok durumu
SELECT 
    KITAP_ADI,
    STOK_ADET,
    CASE 
        WHEN STOK_ADET = 0 THEN 'TÜKENMİŞ'
        WHEN STOK_ADET <= 2 THEN 'AZ STOK'
        ELSE 'YETERLİ'
    END AS DURUM
FROM AT_KITAPLAR;
```

## 📁 Dosya Yapısı

```
OracleFinalProject/
├── 1_Yeni_Kullanici_Olustur.sql    # Kullanıcı oluşturma
├── 2_Ana_Sistem.sql                # Ana sistem kurulumu
├── 3_Test_Ornekleri.sql            # Test örnekleri
├── README.md                       # Bu dosya
└── (eski dosyalar)                 # Önceki versiyonlar
```

## 🔐 Bağlantı Bilgileri

**Yeni Kullanıcı:**
- Kullanıcı Adı: `AT_KUTUPHANE`
- Şifre: `123456`

**Bağlantı Örneği:**
```bash
sqlplus AT_KUTUPHANE/123456@localhost:1521/XE
```

## ⚠️ Önemli Notlar

1. **İlk kurulum:** Mutlaka SYSTEM veya DBA kullanıcısı ile başlayın
2. **Sıralı kurulum:** Dosyaları 1, 2, 3 sırasıyla çalıştırın
3. **Temiz ortam:** AT_KUTUPHANE kullanıcısında sadece bu sistem olacak
4. **Test verisi:** Sistem otomatik olarak temel test verilerini ekler

## 🎓 Proje Hakkında

Bu proje Oracle PL/SQL'in tüm temel özelliklerini içeren kapsamlı bir uygulamadır:
- ✅ Tables & Constraints
- ✅ Sequences
- ✅ Procedures
- ✅ Functions
- ✅ Triggers
- ✅ Views
- ✅ Exception Handling
- ✅ Transaction Management

**Geliştirici:** Alperen Toker  
**Tarih:** 27.05.2025 

