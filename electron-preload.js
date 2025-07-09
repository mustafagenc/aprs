const { contextBridge, ipcRenderer } = require('electron');

// Güvenli API'leri ana dünyaya expose et
contextBridge.exposeInMainWorld('electronAPI', {
    // Uygulama versiyonunu al
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    
    // Hakkında dialog'unu göster
    showAboutDialog: () => ipcRenderer.invoke('show-about-dialog'),
    
    // Harici URL'yi varsayılan tarayıcıda aç
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Platform bilgisi
    platform: process.platform,
    
    // Electron mı kontrol et
    isElectron: true,
    
    // Node.js versiyon bilgileri
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
});

// Console log'larını ana process'e ilet
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
    originalConsoleLog.apply(console, args);
    // Ana process'e log gönder (isteğe bağlı)
};

console.error = (...args) => {
    originalConsoleError.apply(console, args);
    // Ana process'e error gönder (isteğe bağlı)
};

console.warn = (...args) => {
    originalConsoleWarn.apply(console, args);
    // Ana process'e warning gönder (isteğe bağlı)
};

// DOM hazır olduğunda çalışacak kod
document.addEventListener('DOMContentLoaded', () => {
    console.log('🖥️  APRS-FI Desktop (Electron) modunda çalışıyor');
    
    // Electron badge'i ekle (isteğe bağlı)
    if (document.querySelector('h1')) {
        const badge = document.createElement('span');
        badge.textContent = '🖥️ Desktop';
        badge.style.cssText = `
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            margin-left: 10px;
            display: inline-block;
            vertical-align: middle;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        
        // H1 başlığına badge ekle
        const h1 = document.querySelector('h1');
        if (h1) {
            h1.appendChild(badge);
        }
    }
});

console.log('📱 Electron preload script yüklendi');
