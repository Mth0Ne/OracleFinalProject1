// Global değişkenler
let uyeler = [];
let kitaplar = [];
let oduncListesi = [];
let gecIadeLog = [];
let isLoading = false;
let lastFetchTimes = new Map(); // Backend cache ile koordinasyon için

// Sayfa yüklendiğinde çalışacak fonksiyonlar
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    attachEventListeners();
});

function initializeApp() {
    // Loading göstergesini başlat
    showGlobalLoading(true);
    
    // Başlangıç verilerini yükle
    loadAllData();
    
    // Tab değişiklik olaylarını dinle
    const tabLinks = document.querySelectorAll('.data-nav .nav-link');
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab(this.getAttribute('data-tab'));
        });
    });
}

function attachEventListeners() {
    // Form submit olayları
    document.getElementById('uyeForm').addEventListener('submit', handleUyeEkle);
    document.getElementById('kitapForm').addEventListener('submit', handleKitapEkle);
    document.getElementById('oduncForm').addEventListener('submit', handleOduncVer);
    document.getElementById('iadeForm').addEventListener('submit', handleIade);
    
    // Input olayları (debounce ile optimize edilmiş)
    let uyeTimeout, kitapTimeout;
    
    document.getElementById('uyeId').addEventListener('input', function() {
        clearTimeout(uyeTimeout);
        uyeTimeout = setTimeout(() => updateUyeKitapSayisi(), 800); // 800ms debounce
    });
    
    document.getElementById('kitapId').addEventListener('input', function() {
        clearTimeout(kitapTimeout);
        kitapTimeout = setTimeout(() => updateStokBilgisi(), 800);
    });
}

// Backend cache ile koordineli veri yükleme
async function loadAllData() {
    if (isLoading) return;
    
    isLoading = true;
    
    try {
        // Backend cache'i kullan, JavaScript cache'i azalt
        const now = Date.now();
        const shouldRefresh = checkShouldRefresh();
        
        if (!shouldRefresh && uyeler.length > 0) {
            renderAllData();
            updateStatistics();
            showGlobalLoading(false);
            isLoading = false;
            return;
        }
        
        // Paralel veri yükleme - backend cache'e güven
        const [uyelerData, kitaplarData, oduncData, logData] = await Promise.all([
            fetchOptimized('/api/uyeler'),
            fetchOptimized('/api/kitaplar'),
            fetchOptimized('/api/odunc_listesi'),
            fetchOptimized('/api/gec_iade_log')
        ]);
        
        uyeler = uyelerData;
        kitaplar = kitaplarData;
        oduncListesi = oduncData;
        gecIadeLog = logData;
        
        // Fetch zamanını kaydet
        lastFetchTimes.set('allData', now);
        
        renderAllData();
        updateStatistics();
        
    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
        showAlert('Veriler yüklenirken hata oluştu. Lütfen sayfayı yenileyin.', 'danger');
    } finally {
        showGlobalLoading(false);
        isLoading = false;
    }
}

// Optimized fetch - Backend cache headers'ını kullan
async function fetchOptimized(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Cache-Control': 'max-age=30', // Backend cache ile uyumlu
                ...options.headers
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
}

// Smart refresh checker - Gereksiz API çağırımlarını önle
function checkShouldRefresh() {
    const lastFetch = lastFetchTimes.get('allData');
    if (!lastFetch) return true;
    
    const timeDiff = Date.now() - lastFetch;
    return timeDiff > 25000; // Backend cache (30s)'den biraz önce
}

// Retry mekanizması - Sadece kritik hatalarda
async function fetchWithRetry(url, retries = 1) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fetchOptimized(url);
        } catch (error) {
            if (i === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        }
    }
}

function renderAllData() {
    renderUyeler();
    renderKitaplar();
    renderOduncListesi();
    renderGecIadeLog();
}

function showGlobalLoading(show) {
    const containers = [
        'uyelerTableBody',
        'kitaplarTableBody', 
        'oduncTableBody',
        'gecIadeTableBody'
    ];
    
    containers.forEach(id => {
        const tbody = document.getElementById(id);
        if (tbody) {
            if (show) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center loading">Veriler yükleniyor...</td></tr>';
            }
        }
    });
    
    // İstatistik kartlarında loading göster
    if (show) {
        ['totalUyeler', 'totalKitaplar', 'aktifOdunc', 'gecIadeCount'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '-';
        });
    }
}

// Üye işlemleri - Optimize edilmiş
async function loadUyeler(force = false) {
    if (!force && uyeler.length > 0) return;
    
    try {
        const response = await fetchOptimized('/api/uyeler');
        uyeler = response;
        renderUyeler();
        lastFetchTimes.delete('allData'); // Cache'i temizle
    } catch (error) {
        console.error('Üyeler yüklenirken hata:', error);
        showAlert('Üyeler yüklenirken hata oluştu', 'danger');
    }
}

function renderUyeler() {
    const tbody = document.getElementById('uyelerTableBody');
    if (!tbody) return;
    
    if (uyeler.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Henüz üye bulunmuyor</td></tr>';
        return;
    }
    
    tbody.innerHTML = uyeler.map(uye => `
        <tr class="fade-in">
            <td><strong class="text-primary">${uye.UYE_ID}</strong></td>
            <td>${uye.AD} ${uye.SOYAD}</td>
            <td><small class="text-muted">${formatDate(uye.KAYIT_TARIHI)}</small></td>
        </tr>
    `).join('');
}

async function handleUyeEkle(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        // Loading state
        submitBtn.innerHTML = '<i data-lucide="loader" class="me-2"></i>Ekleniyor...';
        submitBtn.disabled = true;
        
        const formData = new FormData(e.target);
        const data = {
            ad: formData.get('ad')?.trim(),
            soyad: formData.get('soyad')?.trim()
        };
        
        // Basit client-side validation (UX için)
        if (!data.ad || !data.soyad) {
            showAlert('Lütfen tüm alanları doldurun', 'warning');
            return;
        }
        
        // Backend validation'a güven
        const response = await fetch('/api/uye_ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            e.target.reset();
            
            // Sadece üyeleri tekrar yükle
            await loadUyeler(true);
            updateStatistics();
        } else {
            // Backend'den gelen hata mesajını doğrudan kullan
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        console.error('Üye ekleme hatası:', error);
        showAlert('Bağlantı hatası oluştu', 'danger');
    } finally {
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
}

// Kitap işlemleri - Optimize edilmiş
async function loadKitaplar(force = false) {
    if (!force && kitaplar.length > 0) return;
    
    try {
        const response = await fetchOptimized('/api/kitaplar');
        kitaplar = response;
        renderKitaplar();
        lastFetchTimes.delete('allData');
    } catch (error) {
        console.error('Kitaplar yüklenirken hata:', error);
        showAlert('Kitaplar yüklenirken hata oluştu', 'danger');
    }
}

function renderKitaplar() {
    const tbody = document.getElementById('kitaplarTableBody');
    if (!tbody) return;
    
    if (kitaplar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Henüz kitap bulunmuyor</td></tr>';
        return;
    }
    
    tbody.innerHTML = kitaplar.map(kitap => `
        <tr class="fade-in">
            <td><strong class="text-primary">${kitap.KITAP_ID}</strong></td>
            <td><strong>${kitap.KITAP_ADI}</strong></td>
            <td>${kitap.YAZAR}</td>
            <td>
                <span class="badge ${kitap.STOK_ADET > 0 ? 'status-active' : 'status-overdue'}">
                    ${kitap.STOK_ADET} adet
                </span>
            </td>
        </tr>
    `).join('');
}

async function handleKitapEkle(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i data-lucide="loader" class="me-2"></i>Ekleniyor...';
        submitBtn.disabled = true;
        
        const formData = new FormData(e.target);
        const data = {
            kitap_adi: formData.get('kitap_adi')?.trim(),
            yazar: formData.get('yazar')?.trim(),
            stok_adedi: formData.get('stok_adedi')
        };
        
        // Basit client-side validation
        if (!data.kitap_adi || !data.yazar || !data.stok_adedi) {
            showAlert('Lütfen tüm alanları doldurun', 'warning');
            return;
        }
        
        const response = await fetch('/api/kitap_ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            e.target.reset();
            
            await loadKitaplar(true);
            updateStatistics();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        console.error('Kitap ekleme hatası:', error);
        showAlert('Bağlantı hatası oluştu', 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
}

// Ödünç işlemleri - Optimize edilmiş
async function loadOduncListesi(force = false) {
    if (!force && oduncListesi.length > 0) return;
    
    try {
        const response = await fetchOptimized('/api/odunc_listesi');
        oduncListesi = response;
        renderOduncListesi();
        lastFetchTimes.delete('allData');
    } catch (error) {
        console.error('Ödünç listesi yüklenirken hata:', error);
        showAlert('Ödünç listesi yüklenirken hata oluştu', 'danger');
    }
}

function renderOduncListesi() {
    const tbody = document.getElementById('oduncTableBody');
    if (!tbody) return;
    
    if (oduncListesi.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Henüz ödünç işlemi bulunmuyor</td></tr>';
        return;
    }
    
    tbody.innerHTML = oduncListesi.map(odunc => `
        <tr class="fade-in">
            <td><strong class="text-primary">${odunc.ODUNC_ID}</strong></td>
            <td>${odunc.UYE_ID}</td>
            <td>${odunc.KITAP_ID}</td>
            <td><small>${odunc.ALIS_TARIHI}</small></td>
            <td><small>${odunc.IADE_TARIHI || '-'}</small></td>
            <td>
                <span class="badge ${odunc.TESLIM_EDILDI_MI === 'Y' ? 'status-returned' : 'status-active'}">
                    ${odunc.TESLIM_EDILDI_MI === 'Y' ? 'Teslim Edildi' : 'Beklemede'}
                </span>
            </td>
        </tr>
    `).join('');
}

async function handleOduncVer(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i data-lucide="loader" class="me-2"></i>İşleniyor...';
        submitBtn.disabled = true;
        
        const formData = new FormData(e.target);
        const data = {
            uye_id: formData.get('uye_id'),
            kitap_id: formData.get('kitap_id')
        };
        
        console.log('🔧 DEBUG: Form data:', data);
        
        if (!data.uye_id || !data.kitap_id) {
            showAlert('Lütfen tüm alanları doldurun', 'warning');
            return;
        }
        
        console.log('🔧 DEBUG: Sending request to API...');
        const response = await fetch('/api/kitap_odunc_ver', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        console.log('🔧 DEBUG: Response status:', response.status);
        console.log('🔧 DEBUG: Response ok:', response.ok);
        
        const result = await response.json();
        console.log('🔧 DEBUG: Response JSON:', result);
        
        if (result.success) {
            console.log('✅ DEBUG: Success case');
            showAlert(result.message, 'success');
            e.target.reset();
            
            // Info alanlarını temizle
            document.getElementById('uyeInfo').innerHTML = '';
            document.getElementById('stokInfo').innerHTML = '';
            
            // Sadece gerekli verileri yükle
            await Promise.all([loadOduncListesi(true), loadKitaplar(true)]);
            updateStatistics();
        } else {
            console.log('❌ DEBUG: Error case - showing alert with:', result.error);
            showAlert(result.error || 'Bilinmeyen bir hata oluştu', 'danger');
        }
    } catch (error) {
        console.error('❌ DEBUG: Exception caught:', error);
        showAlert('Bağlantı hatası oluştu', 'danger');
    } finally {
        console.log('🔧 DEBUG: Finally block - resetting button');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
}

// İade işlemleri - Optimize edilmiş
async function handleIade(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<i data-lucide="loader" class="me-2"></i>İşleniyor...';
        submitBtn.disabled = true;
        
        const formData = new FormData(e.target);
        const data = { odunc_id: formData.get('odunc_id') };
        
        if (!data.odunc_id) {
            showAlert('Lütfen ödünç ID\'sini girin', 'warning');
            return;
        }
        
        const response = await fetch('/api/kitap_iade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert(result.message, 'success');
            e.target.reset();
            
            // Gerekli verileri yükle
            await Promise.all([
                loadOduncListesi(true), 
                loadKitaplar(true), 
                loadGecIadeLog(true)
            ]);
            updateStatistics();
        } else {
            showAlert(result.error, 'danger');
        }
    } catch (error) {
        console.error('İade hatası:', error);
        showAlert('Bağlantı hatası oluştu', 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
}

// Geç iade log - Optimize edilmiş
async function loadGecIadeLog(force = false) {
    if (!force && gecIadeLog.length > 0) return;
    
    try {
        const response = await fetchOptimized('/api/gec_iade_log');
        gecIadeLog = response;
        renderGecIadeLog();
        lastFetchTimes.delete('allData');
    } catch (error) {
        console.error('Geç iade log yüklenirken hata:', error);
        showAlert('Geç iade log yüklenirken hata oluştu', 'danger');
    }
}

function renderGecIadeLog() {
    const tbody = document.getElementById('gecIadeTableBody');
    if (!tbody) return;
    
    if (gecIadeLog.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Henüz geç iade kaydı bulunmuyor</td></tr>';
        return;
    }
    
    tbody.innerHTML = gecIadeLog.map(log => `
        <tr class="fade-in">
            <td><strong class="text-primary">${log.LOG_ID}</strong></td>
            <td>${log.ODUNC_ID}</td>
            <td><small class="text-danger">${log.GEC_IADE_TARIHI}</small></td>
        </tr>
    `).join('');
}

// Yardımcı fonksiyonlar - Debounce ile optimize edilmiş
async function updateUyeKitapSayisi() {
    const uyeId = document.getElementById('uyeId').value;
    const infoDiv = document.getElementById('uyeInfo');
    
    if (!uyeId || !infoDiv) return;
    
    if (uyeId.length < 1) {
        infoDiv.innerHTML = '';
        return;
    }
    
    try {
        infoDiv.innerHTML = '<div class="alert alert-info"><i data-lucide="loader"></i> Kontrol ediliyor...</div>';
        lucide.createIcons();
        
        // Backend cache kullan
        const response = await fetchOptimized(`/api/uye_kitap_sayisi/${uyeId}`);
        
        infoDiv.innerHTML = `
            <div class="alert alert-info">
                <i data-lucide="info"></i>
                Bu üyenin elinde <strong>${response.kitap_sayisi}</strong> kitap bulunuyor
            </div>
        `;
        lucide.createIcons();
    } catch (error) {
        console.error('Üye kitap sayısı alınırken hata:', error);
        infoDiv.innerHTML = `<div class="alert alert-danger"><i data-lucide="x-circle"></i> Üye bilgisi alınamadı</div>`;
        lucide.createIcons();
    }
}

async function updateStokBilgisi() {
    const kitapId = document.getElementById('kitapId').value;
    const infoDiv = document.getElementById('stokInfo');
    
    if (!kitapId || !infoDiv) return;
    
    if (kitapId.length < 1) {
        infoDiv.innerHTML = '';
        return;
    }
    
    try {
        infoDiv.innerHTML = '<div class="alert alert-info"><i data-lucide="loader"></i> Kontrol ediliyor...</div>';
        lucide.createIcons();
        
        const response = await fetchOptimized(`/api/stok_sorgula/${kitapId}`);
        
        const stokStatus = response.stok > 0 ? 'success' : 'danger';
        const stokText = response.stok > 0 ? 'Stokta var' : 'Stokta yok';
        
        infoDiv.innerHTML = `
            <div class="alert alert-${stokStatus}">
                <i data-lucide="${response.stok > 0 ? 'check-circle' : 'x-circle'}"></i>
                ${stokText} - <strong>${response.stok}</strong> adet
            </div>
        `;
        lucide.createIcons();
    } catch (error) {
        console.error('Stok bilgisi alınırken hata:', error);
        infoDiv.innerHTML = `<div class="alert alert-danger"><i data-lucide="x-circle"></i> Stok bilgisi alınamadı</div>`;
        lucide.createIcons();
    }
}

function updateStatistics() {
    // İstatistikleri güncelle
    document.getElementById('totalUyeler').textContent = uyeler.length;
    document.getElementById('totalKitaplar').textContent = kitaplar.length;
    
    const aktifOdunc = oduncListesi.filter(o => o.TESLIM_EDILDI_MI === 'N').length;
    document.getElementById('aktifOdunc').textContent = aktifOdunc;
    
    document.getElementById('gecIadeCount').textContent = gecIadeLog.length;
}

function switchTab(tabName) {
    // Tab linklerini güncelle
    document.querySelectorAll('.data-nav .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Tab içeriklerini göster/gizle
    document.querySelectorAll('.table-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(tabName).style.display = 'block';
}

function showAlert(message, type) {
    console.log(`🔔 DEBUG: showAlert called with message: "${message}", type: "${type}"`);
    
    // Mevcut alertleri temizle (max 3 alert)
    const existingAlerts = document.querySelectorAll('.alert-dismissible');
    if (existingAlerts.length >= 3) {
        existingAlerts[0].remove();
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '100px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '300px';
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'danger' ? 'x-circle' : 
                 type === 'warning' ? 'alert-triangle' : 'info';
    
    alertDiv.innerHTML = `
        <i data-lucide="${icon}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    console.log(`🔔 DEBUG: Alert div created and will be added to body`);
    document.body.appendChild(alertDiv);
    
    // Lucide ikonlarını yeniden yükle
    lucide.createIcons();
    
    // 5 saniye sonra otomatik kapat
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
            console.log(`🔔 DEBUG: Alert automatically removed after 5 seconds`);
        }
    }, 5000);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR');
    } catch {
        return dateString;
    }
} 