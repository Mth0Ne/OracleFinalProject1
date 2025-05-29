#!/bin/bash

echo "🚀 AT Kütüphane Otomasyon Sistemi - Web Arayüzü Başlatılıyor..."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}📚 AT Kütüphane Otomasyon Sistemi${NC}"
echo -e "${BLUE}======================================${NC}"

python_version=$(python3 --version 2>&1)
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Python bulundu: $python_version${NC}"
else
    echo -e "${RED}❌ Python3 bulunamadı! Lütfen Python3 yükleyin.${NC}"
    exit 1
fi

if ! python3 -m venv --help > /dev/null 2>&1; then
    echo -e "${RED}❌ python3-venv eksik! Yükleniyor...${NC}"
    sudo apt update && sudo apt install -y python3-venv python3-pip
fi

if [ ! -d "venv" ]; then
    echo -e "${YELLOW}🔧 Sanal ortam oluşturuluyor...${NC}"
    python3 -m venv venv
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ Sanal ortam oluşturulamadı!${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}🔧 Sanal ortam aktifleştiriliyor...${NC}"
source venv/bin/activate

echo -e "${YELLOW}📦 pip güncelleniyor...${NC}"
python -m pip install --upgrade pip > /dev/null 2>&1

echo -e "${YELLOW}📦 Python paketleri yükleniyor...${NC}"
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt > /dev/null 2>&1
    echo -e "${GREEN}✅ Python paketleri yüklendi${NC}"
else
    echo -e "${YELLOW}📦 Temel paketler yükleniyor...${NC}"
    pip install flask oracledb > /dev/null 2>&1
    echo -e "${GREEN}✅ Flask ve OracleDB yüklendi${NC}"
fi

echo -e "${PURPLE}🔧 Modern OracleDB Thick Client Mode Bilgisi:${NC}"
echo -e "${YELLOW}ℹ️  Bu versiyon modern 'oracledb' paketini kullanır${NC}"
echo -e "${YELLOW}ℹ️  Instant Client otomatik olarak yüklenecek (gerekirse)${NC}"
echo -e "${YELLOW}ℹ️  Thick mode için Oracle Client gerekmez${NC}"

echo ""
echo -e "${PURPLE}🔍 Oracle Bağlantı Bilgileri:${NC}"
echo -e "${YELLOW}Kullanıcı: ${GREEN}AT_KUTUPHANE${NC}"
echo -e "${YELLOW}Şifre: ${GREEN}123456${NC}"
echo -e "${YELLOW}DSN: ${GREEN}localhost:1521/XE${NC}"
echo ""
echo -e "${YELLOW}⚠️  Oracle Database'in çalıştığından emin olun!${NC}"

if netstat -tln | grep ":5000 " > /dev/null; then
    echo -e "${YELLOW}⚠️  Port 5000 zaten kullanımda! Önceki süreci durduruyor...${NC}"
    pkill -f "python.*app.py" 2>/dev/null || true
    sleep 2
fi

echo ""
echo -e "${GREEN}🌟 Web uygulaması başlatılıyor...${NC}"
echo -e "${GREEN}📍 Tarayıcınızda şu adresi açın: ${BLUE}http://localhost:5000${NC}"
echo ""
echo -e "${GREEN}🚀 Performans Optimizasyonları:${NC}"
echo -e "${YELLOW}   • Bağlantı havuzu aktif (2-8 bağlantı)${NC}"
echo -e "${YELLOW}   • Backend cache sistemi (15-60s)${NC}"
echo -e "${YELLOW}   • Frontend optimizasyonları${NC}"
echo -e "${YELLOW}   • Modern UI/UX tasarımı${NC}"
echo ""
echo -e "${YELLOW}⚠️  Uygulamayı durdurmak için Ctrl+C tuşlarını kullanın${NC}"
echo ""

# Flask uygulamasını başlat (Modern OracleDB ile Instant Client gerekmez)
python3 app.py 
