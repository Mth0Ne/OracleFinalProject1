
-- DBMS_OUTPUT'u etkinleştir
SET SERVEROUTPUT ON SIZE 1000000;


-- 1. SEQUENCE'LER


CREATE SEQUENCE AT_UYE_SEQ START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE AT_KITAP_SEQ START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE AT_ODUNC_SEQ START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE AT_LOG_SEQ START WITH 1 INCREMENT BY 1;


-- 2. TABLOLAR


-- Üye Bilgileri Tablosu
CREATE TABLE AT_UYELER (
    UYE_ID NUMBER PRIMARY KEY,
    AD VARCHAR2(55) NOT NULL,
    SOYAD VARCHAR2(55) NOT NULL,
    KAYIT_TARIHI DATE DEFAULT SYSDATE
);

-- Kitap Bilgileri Tablosu
CREATE TABLE AT_KITAPLAR (
    KITAP_ID NUMBER PRIMARY KEY,
    KITAP_ADI VARCHAR2(212) NOT NULL,
    YAZAR VARCHAR2(121) NOT NULL,
    STOK_ADET NUMBER DEFAULT 0 CHECK (STOK_ADET >= 0)
);

-- Ödünç Alma Kayıtları Tablosu
CREATE TABLE AT_ODUNC (
    ODUNC_ID NUMBER PRIMARY KEY,
    UYE_ID NUMBER NOT NULL,
    KITAP_ID NUMBER NOT NULL,
    ALIS_TARIHI DATE DEFAULT SYSDATE,
    IADE_TARIHI DATE,
    TESLIM_EDILDI_MI CHAR(1) DEFAULT 'N' CHECK (TESLIM_EDILDI_MI IN ('Y', 'N')),
    CONSTRAINT FK_AT_ODUNC_UYE FOREIGN KEY (UYE_ID) REFERENCES AT_UYELER(UYE_ID),
    CONSTRAINT FK_AT_ODUNC_KITAP FOREIGN KEY (KITAP_ID) REFERENCES AT_KITAPLAR(KITAP_ID)
);

-- Geç İade Log Tablosu
CREATE TABLE AT_GEC_IADE_LOG (
    LOG_ID NUMBER PRIMARY KEY,
    ODUNC_ID NUMBER NOT NULL,
    GEC_IADE_TARIHI DATE DEFAULT SYSDATE,
    CONSTRAINT FK_AT_LOG_ODUNC FOREIGN KEY (ODUNC_ID) REFERENCES AT_ODUNC(ODUNC_ID)
);


-- 3. FONKSİYONLAR


-- Üyenin toplam kitap sayısını döndürür
CREATE OR REPLACE FUNCTION AT_UYE_KITAP_SAYISI(p_uye_id NUMBER) 
RETURN NUMBER 
IS
    v_kitap_sayisi NUMBER := 0;
BEGIN
    SELECT COUNT(*)
    INTO v_kitap_sayisi
    FROM AT_ODUNC
    WHERE UYE_ID = p_uye_id;
    
    RETURN v_kitap_sayisi;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN 0;
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Hata: ' || SQLERRM);
        RETURN -1;
END AT_UYE_KITAP_SAYISI;
/

-- Kitabın stok adedini sorgular
CREATE OR REPLACE FUNCTION AT_KITAP_STOK_SORGULA(p_kitap_id NUMBER) 
RETURN NUMBER 
IS
    v_stok_adet NUMBER := 0;
BEGIN
    SELECT STOK_ADET
    INTO v_stok_adet
    FROM AT_KITAPLAR
    WHERE KITAP_ID = p_kitap_id;
    
    RETURN v_stok_adet;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Kitap bulunamadı!');
        RETURN -1;
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('Hata: ' || SQLERRM);
        RETURN -1;
END AT_KITAP_STOK_SORGULA;
/


-- 4. PROSEDÜRLER


-- Yeni kitap ekleme prosedürü
CREATE OR REPLACE PROCEDURE AT_YENI_KITAP_EKLE(
    p_kitap_adi VARCHAR2,
    p_yazar VARCHAR2,
    p_stok_adet NUMBER
) 
IS
    v_kitap_id NUMBER;
BEGIN
    SELECT AT_KITAP_SEQ.NEXTVAL INTO v_kitap_id FROM DUAL;
    
    INSERT INTO AT_KITAPLAR (KITAP_ID, KITAP_ADI, YAZAR, STOK_ADET)
    VALUES (v_kitap_id, p_kitap_adi, p_yazar, p_stok_adet);
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Kitap başarıyla eklendi. ID: ' || v_kitap_id);
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('Kitap ekleme hatası: ' || SQLERRM);
END AT_YENI_KITAP_EKLE;
/

-- Yeni üye ekleme prosedürü
CREATE OR REPLACE PROCEDURE AT_YENI_UYE_EKLE(
    p_ad VARCHAR2,
    p_soyad VARCHAR2
) 
IS
    v_uye_id NUMBER;
BEGIN
    SELECT AT_UYE_SEQ.NEXTVAL INTO v_uye_id FROM DUAL;
    
    INSERT INTO AT_UYELER (UYE_ID, AD, SOYAD, KAYIT_TARIHI)
    VALUES (v_uye_id, p_ad, p_soyad, SYSDATE);
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Üye başarıyla eklendi. ID: ' || v_uye_id);
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('Üye ekleme hatası: ' || SQLERRM);
END AT_YENI_UYE_EKLE;
/

-- Kitap ödünç verme prosedürü
CREATE OR REPLACE PROCEDURE AT_KITAP_ODUNC_VER(
    p_uye_id NUMBER,
    p_kitap_id NUMBER
) 
IS
    v_stok_adet NUMBER;
    v_son_iade_tarihi DATE;
    v_gun_farki NUMBER;
    v_odunc_id NUMBER;
    v_uye_var NUMBER := 0;
    v_kitap_var NUMBER := 0;
BEGIN
    -- Üye kontrolü
    SELECT COUNT(*) INTO v_uye_var FROM AT_UYELER WHERE UYE_ID = p_uye_id;
    IF v_uye_var = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Üye bulunamadı!');
    END IF;
    
    -- Kitap kontrolü
    SELECT COUNT(*) INTO v_kitap_var FROM AT_KITAPLAR WHERE KITAP_ID = p_kitap_id;
    IF v_kitap_var = 0 THEN
        RAISE_APPLICATION_ERROR(-20002, 'Kitap bulunamadı!');
    END IF;
    
    -- Stok kontrolü
    SELECT STOK_ADET INTO v_stok_adet FROM AT_KITAPLAR WHERE KITAP_ID = p_kitap_id;
    IF v_stok_adet <= 0 THEN
        RAISE_APPLICATION_ERROR(-20003, 'Kitap stokta yok!');
    END IF;
    
    -- 7 günlük bekleme süresi kontrolü
    BEGIN
        SELECT MAX(IADE_TARIHI) 
        INTO v_son_iade_tarihi
        FROM AT_ODUNC 
        WHERE UYE_ID = p_uye_id 
        AND KITAP_ID = p_kitap_id 
        AND TESLIM_EDILDI_MI = 'Y';
        
        IF v_son_iade_tarihi IS NOT NULL THEN
            v_gun_farki := SYSDATE - v_son_iade_tarihi;
            IF v_gun_farki < 7 THEN
                RAISE_APPLICATION_ERROR(-20004, 'Bu kitabı tekrar alabilmek için ' || 
                    CEIL(7 - v_gun_farki) || ' gün daha beklemelisiniz!');
            END IF;
        END IF;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            NULL; -- İlk defa alıyor
    END;
    
    -- Ödünç kaydı oluştur
    SELECT AT_ODUNC_SEQ.NEXTVAL INTO v_odunc_id FROM DUAL;
    
    INSERT INTO AT_ODUNC (ODUNC_ID, UYE_ID, KITAP_ID, ALIS_TARIHI, TESLIM_EDILDI_MI)
    VALUES (v_odunc_id, p_uye_id, p_kitap_id, SYSDATE, 'N');
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Kitap başarıyla ödünç verildi. Ödünç ID: ' || v_odunc_id);
    
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('Ödünç verme hatası: ' || SQLERRM);
END AT_KITAP_ODUNC_VER;
/

-- Kitap iade etme prosedürü
CREATE OR REPLACE PROCEDURE AT_KITAP_IADE_ET(
    p_odunc_id NUMBER
) 
IS
    v_teslim_durumu CHAR(1);
    v_alis_tarihi DATE;
    v_gun_farki NUMBER;
BEGIN
    SELECT TESLIM_EDILDI_MI, ALIS_TARIHI
    INTO v_teslim_durumu, v_alis_tarihi
    FROM AT_ODUNC
    WHERE ODUNC_ID = p_odunc_id;
    
    IF v_teslim_durumu = 'Y' THEN
        RAISE_APPLICATION_ERROR(-20005, 'Bu kitap zaten teslim edilmiş!');
    END IF;
    
    -- 15 günden fazla geçmiş mi kontrol et
    v_gun_farki := SYSDATE - v_alis_tarihi;
    IF v_gun_farki > 15 THEN
        DBMS_OUTPUT.PUT_LINE('UYARI: Kitap ' || ROUND(v_gun_farki) || 
            ' gündür iade edilmemiş! (Limit: 15 gün)');
    END IF;
    
    UPDATE AT_ODUNC 
    SET IADE_TARIHI = SYSDATE, TESLIM_EDILDI_MI = 'Y'
    WHERE ODUNC_ID = p_odunc_id;
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('Kitap başarıyla iade edildi.');
    
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('Ödünç kaydı bulunamadı!');
    WHEN OTHERS THEN
        ROLLBACK;
        DBMS_OUTPUT.PUT_LINE('İade hatası: ' || SQLERRM);
END AT_KITAP_IADE_ET;
/

-- 5. TRİGGER'LAR

-- Ödünç alındığında stok azaltma
CREATE OR REPLACE TRIGGER AT_TRG_STOK_AZALT
    AFTER INSERT ON AT_ODUNC
    FOR EACH ROW
BEGIN
    UPDATE AT_KITAPLAR 
    SET STOK_ADET = STOK_ADET - 1
    WHERE KITAP_ID = :NEW.KITAP_ID;
    
    DBMS_OUTPUT.PUT_LINE('Kitap stoğu azaltıldı. Kitap ID: ' || :NEW.KITAP_ID);
END AT_TRG_STOK_AZALT;
/

-- Kitap iade edildiğinde stok arttırma
CREATE OR REPLACE TRIGGER AT_TRG_STOK_ARTTIR
    AFTER UPDATE OF TESLIM_EDILDI_MI ON AT_ODUNC
    FOR EACH ROW
    WHEN (OLD.TESLIM_EDILDI_MI = 'N' AND NEW.TESLIM_EDILDI_MI = 'Y')
BEGIN
    UPDATE AT_KITAPLAR 
    SET STOK_ADET = STOK_ADET + 1
    WHERE KITAP_ID = :NEW.KITAP_ID;
    
    DBMS_OUTPUT.PUT_LINE('Kitap stoğu arttırıldı. Kitap ID: ' || :NEW.KITAP_ID);
END AT_TRG_STOK_ARTTIR;
/

-- Geç iade durumunda log tablosuna kayıt
CREATE OR REPLACE TRIGGER AT_TRG_GEC_IADE_LOG
    AFTER UPDATE OF IADE_TARIHI ON AT_ODUNC
    FOR EACH ROW
    WHEN (NEW.IADE_TARIHI IS NOT NULL AND NEW.IADE_TARIHI > OLD.ALIS_TARIHI + 15)
DECLARE
    v_log_id NUMBER;
BEGIN
    SELECT AT_LOG_SEQ.NEXTVAL INTO v_log_id FROM DUAL;
    
    INSERT INTO AT_GEC_IADE_LOG (LOG_ID, ODUNC_ID, GEC_IADE_TARIHI)
    VALUES (v_log_id, :NEW.ODUNC_ID, SYSDATE);
    
    DBMS_OUTPUT.PUT_LINE('Geç iade kaydı oluşturuldu. Ödünç ID: ' || :NEW.ODUNC_ID);
END AT_TRG_GEC_IADE_LOG;
/

-- 6. VIEW'LAR

CREATE OR REPLACE VIEW AT_SISTEM_DURUMU AS
SELECT 
    'TOPLAM ÜYE' AS KATEGORI,
    COUNT(*) AS SAYI
FROM AT_UYELER
UNION ALL
SELECT 
    'TOPLAM KİTAP' AS KATEGORI,
    COUNT(*) AS SAYI
FROM AT_KITAPLAR
UNION ALL
SELECT 
    'AKTİF ÖDÜNÇ' AS KATEGORI,
    COUNT(*) AS SAYI
FROM AT_ODUNC 
WHERE TESLIM_EDILDI_MI = 'N'
UNION ALL
SELECT 
    'GEÇ İADE' AS KATEGORI,
    COUNT(*) AS SAYI
FROM AT_GEC_IADE_LOG;

-- 7. TEMEL TEST VERİLERİ

BEGIN
    DBMS_OUTPUT.PUT_LINE('=== TEMEL VERİLER EKLENİYOR ===');
    
    -- Temel üyeler
    AT_YENI_UYE_EKLE('Alperen', 'Toker');
    AT_YENI_UYE_EKLE('Mehmet', 'Yılmaz');
    AT_YENI_UYE_EKLE('Ayşe', 'Kaya');
    
    -- Temel kitaplar
    AT_YENI_KITAP_EKLE('Oracle PL/SQL Programlama', 'Scott Urman', 5);
    AT_YENI_KITAP_EKLE('Veritabanı Sistemleri', 'Raghu Ramakrishnan', 3);
    AT_YENI_KITAP_EKLE('SQL Öğreniyorum', 'Alan Beaulieu', 2);
    
    DBMS_OUTPUT.PUT_LINE('=== TEMEL VERİLER EKLENDİ ===');
END;
/

-- Sistem durumunu göster
SELECT * FROM AT_SISTEM_DURUMU;

-- Son mesaj
BEGIN
    DBMS_OUTPUT.PUT_LINE('==========================================');
    DBMS_OUTPUT.PUT_LINE('AT_ KÜTÜPHANE SİSTEMİ KURULUMU TAMAMLANDI!');
    DBMS_OUTPUT.PUT_LINE('==========================================');
    DBMS_OUTPUT.PUT_LINE('Sonraki adım: 3_Test_Ornekleri.sql çalıştır');
    DBMS_OUTPUT.PUT_LINE('==========================================');
END;
/ 
