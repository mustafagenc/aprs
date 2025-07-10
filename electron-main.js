const { app, BrowserWindow, Menu, Tray, dialog, shell, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Electron modunu aktive et
process.env.ELECTRON_MODE = 'true';

// Geliştirme modunu kontrol et
const isDev = process.env.NODE_ENV === 'development';

// Pencere referansı
let mainWindow;
let settingsWindow;
let tray;
let webServerProcess;

// Web sunucu portu
const WEB_SERVER_PORT = process.env.PORT || 3000;

/**
 * Ana pencere oluştur
 */
function createWindow() {
    // Ana pencereyi oluştur
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        icon: path.join(__dirname, 'public/favicon/favicon-16x16.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'electron-preload.js')
        },
        titleBarStyle: 'default', // Normal title bar - taşınabilir
        title: 'APRS Position Sender',
        show: false // Başlangıçta gizli, hazır olunca göster
    });

    // Web sunucusunu başlat
    startWebServer();

    // Window hazır olduğunda göster
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Geliştirme modunda DevTools'u aç
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Pencere kapatılmaya çalışıldığında (X butonu)
    mainWindow.on('close', (event) => {
        // Uygulama tamamen çıkış yapılmıyorsa, tray'e gizle
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            
            // macOS'ta dock'tan da gizle
            if (process.platform === 'darwin' && app.dock) {
                app.dock.hide();
            }
            
            // İlk defa gizlendiğinde kullanıcıya bilgi ver
            if (!mainWindow.hasShownTrayNotification) {
                if (process.platform === 'win32') {
                    // Windows için balloon notification
                    tray.displayBalloon({
                        iconType: 'info',
                        title: 'APRS Position Sender',
                        content: 'Uygulama arka planda çalışmaya devam ediyor. Sistem tepsisinden erişebilirsiniz.'
                    });
                } else {
                    // macOS ve Linux için sistem bildirimi
                    if (Notification.isSupported()) {
                        new Notification({
                            title: 'APRS Position Sender',
                            body: 'Uygulama arka planda çalışmaya devam ediyor. Sistem tepsisinden erişebilirsiniz.',
                            silent: false
                        }).show();
                    }
                }
                mainWindow.hasShownTrayNotification = true;
            }
        }
    });

    // Pencere kapatıldığında (tamamen yok edildiğinde)
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Pencere minimize edildiğinde sistem tepsisine gizle (Windows/Linux)
    mainWindow.on('minimize', (event) => {
        if (process.platform !== 'darwin') {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // External linkler varsayılan tarayıcıda açılsın
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

/**
 * Web sunucusunu başlat
 */
function startWebServer() {
    console.log('🚀 Web sunucusu başlatılıyor...');
    
    // Electron ortamında fork kullan
    const { fork } = require('child_process');
    
    // User data path'i al
    const userDataPath = app.getPath('userData');
    console.log(`📁 User data path: ${userDataPath}`);
    
    webServerProcess = fork(path.join(__dirname, 'web-server.js'), [], {
        env: { 
            ...process.env, 
            ELECTRON_MODE: 'true',
            USER_DATA_PATH: userDataPath
        },
        silent: true,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    webServerProcess.stdout.on('data', (data) => {
        console.log(`Web Server: ${data}`);
    });

    webServerProcess.stderr.on('data', (data) => {
        console.error(`Web Server Error: ${data}`);
    });

    webServerProcess.on('close', (code) => {
        console.log(`Web server process exited with code ${code}`);
    });

    // Web sunucusunun başlamasını bekle ve URL'yi yükle
    setTimeout(() => {
        const url = `http://localhost:${WEB_SERVER_PORT}`;
        console.log(`📡 APRS-FI yükleniyor: ${url}`);
        mainWindow.loadURL(url);
    }, 2000);
}

/**
 * Ayarlar penceresi oluştur
 */
function createSettingsWindow() {
    // Zaten açık ise ön plana getir
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 700,
        minHeight: 500,
        icon: path.join(__dirname, 'public/favicon/favicon-16x16.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'electron-preload.js')
        },
        titleBarStyle: 'default', // Normal title bar
        title: 'Uygulama Ayarları',
        parent: mainWindow,
        darkTheme: true,
        show: false,
        resizable: false,
        minimizable: false, 
        maximizable: false, 
        closable: true, 
        movable: true, 
        center: true, 
        frame: true, // Pencere çerçevesi zorla göster
        hasShadow: true,
        skipTaskbar: false // Taskbar'da görünsün
    });

    // Ayarlar HTML'ini yükle
    settingsWindow.loadFile(path.join(__dirname, 'public/settings.html'));

    // Pencere hazır olduğunda göster
    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show();
        settingsWindow.focus();
    });

    // Pencere kapatıldığında
    settingsWindow.on('closed', () => {
        settingsWindow = null;
        // Ana pencereyi tekrar aktif et
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setEnabled(true);
            mainWindow.focus();
        }
    });
}

/**
 * Sistem tepsisi oluştur
 */
function createTray() {
    let trayIconPath;
    
    if (process.platform === 'win32') {
        trayIconPath = path.join(__dirname, 'public/favicon/favicon.ico');
    } else if (process.platform === 'darwin') {
        // macOS için apple-touch-icon kullan ve template olarak işaretle
        trayIconPath = path.join(__dirname, 'public/favicon/favicon-16x16.png');
    } else {
        // Linux için PNG ikonu
        trayIconPath = path.join(__dirname, 'public/favicon/favicon-16x16.png');
    }

    tray = new Tray(trayIconPath);
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'APRS Position Sender',
            type: 'normal',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Pencereyi Göster',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                    // macOS'ta dock'ı tekrar göster
                    if (process.platform === 'darwin' && app.dock) {
                        app.dock.show();
                    }
                }
            }
        },
        {
            label: 'Pencereyi Gizle',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                    // macOS'ta dock'tan da gizle
                    if (process.platform === 'darwin' && app.dock) {
                        app.dock.hide();
                    }
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Ayarlar',
            click: () => {
                createSettingsWindow();
            }
        },
        { type: 'separator' },
        {
            label: 'GitHub Repository',
            click: () => {
                shell.openExternal('https://github.com/mustafagenc/aprs');
            }
        },
        {
            label: 'APRS.fi\'yi Aç',
            click: () => {
                shell.openExternal('https://aprs.fi');
            }
        },
        { type: 'separator' },
        {
            label: 'Hakkında',
            click: () => {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'APRS Position Sender Hakkında',
                    message: 'APRS Position Sender',
                    detail: `Versiyon: ${app.getVersion()}
Uygulamayı Geliştiren
Mustafa Genç
eposta@mustafagenc.info
APRS Position Sender with Desktop Integration

Bu uygulama amatör telsiz operatörleri için geliştirilmiştir.`,
                    buttons: ['Tamam']
                });
            }
        },
        { type: 'separator' },
        {
            label: 'Çıkış',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('APRS Position Sender - Amatör Telsiz APRS Gönderici');

    // Tray ikonuna tek tıklayınca - tüm platformlarda context menu aç
    tray.on('click', () => {
        console.log('Tray click event triggered - Platform:', process.platform);
        // Tüm platformlarda sol tıklama ile context menu aç
        tray.popUpContextMenu();
    });

    // Sağ tıklama da zaten context menu açıyor (varsayılan davranış)
    tray.on('right-click', () => {
        console.log('Tray right-click event triggered');
        // Context menu zaten otomatik açılır, ek bir şey yapmaya gerek yok
        // Ama manuel olarak da açabiliriz
        tray.popUpContextMenu();
    });

    // Tray ikonuna çift tıklayınca pencereyi göster (tüm platformlar için)
    tray.on('double-click', () => {
        console.log('Tray double-click event triggered');
        if (mainWindow) {
            console.log('Double-click: Showing window');
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            // macOS'ta dock'ı tekrar göster
            if (process.platform === 'darwin' && app.dock) {
                app.dock.show();
            }
        } else {
            console.log('Double-click: Main window does not exist');
        }
    });
}

/**
 * Uygulama menüsünü oluştur
 */
function createMenu() {
    const template = [
        {
            label: 'Dosya',
            submenu: [
                {
                    label: 'Ayarlar',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        createSettingsWindow();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Yeniden Yükle',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.reload();
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Görünüm',
            submenu: [
                {
                    label: 'Tam Ekran',
                    accelerator: 'F11',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.setFullScreen(!mainWindow.isFullScreen());
                        }
                    }
                },
                {
                    label: 'Yakınlaştır',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        if (mainWindow) {
                            const zoomLevel = mainWindow.webContents.getZoomLevel();
                            mainWindow.webContents.setZoomLevel(zoomLevel + 0.5);
                        }
                    }
                },
                {
                    label: 'Uzaklaştır',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        if (mainWindow) {
                            const zoomLevel = mainWindow.webContents.getZoomLevel();
                            mainWindow.webContents.setZoomLevel(zoomLevel - 0.5);
                        }
                    }
                },
                {
                    label: 'Normal Boyut',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.setZoomLevel(0);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Geliştirici Araçları',
                    accelerator: 'F12',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.toggleDevTools();
                        }
                    }
                }
            ]
        },
        {
            label: 'APRS',
            submenu: [
                {
                    label: 'APRS.fi\'yi Aç',
                    click: () => {
                        shell.openExternal('https://aprs.fi');
                    }
                },
                {
                    label: 'APRS Sembol Tablosu',
                    click: () => {
                        shell.openExternal('http://www.aprs.org/symbols.html');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Konfigürasyon Dosyasını Aç',
                    click: () => {
                        const envPath = path.join(__dirname, '.env');
                        shell.openPath(envPath);
                    }
                }
            ]
        },
        {
            label: 'Yardım',
            submenu: [
                {
                    label: 'GitHub Repository',
                    click: () => {
                        shell.openExternal('https://github.com/mustafagenc/aprs');
                    }
                },
                {
                    label: 'TB2ABI Website',
                    click: () => {
                        shell.openExternal('https://mustafagenc.info');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Hakkında',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'APRS Position Sender Hakkında',
                            message: 'APRS Position Sender',
                            detail: `Versiyon: ${app.getVersion()}
Uygulamayı Geliştiren
Mustafa Genç
eposta@mustafagenc.info
APRS Position Sender with Desktop Integration

Bu uygulama amatör telsiz operatörleri için geliştirilmiştir.

Lisans: ISC
Node.js: ${process.versions.node}
Chromium: ${process.versions.chrome}
Electron: ${process.versions.electron}`,
                            buttons: ['Tamam']
                        });
                    }
                }
            ]
        }
    ];

    // macOS için özel menü düzenlemesi
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                {
                    label: 'APRS Position Sender Hakkında',
                    role: 'about'
                },
                { type: 'separator' },
                {
                    label: 'Hizmetler',
                    role: 'services',
                    submenu: []
                },
                { type: 'separator' },
                {
                    label: 'APRS Position Sender\'ı Gizle',
                    accelerator: 'Command+H',
                    role: 'hide'
                },
                {
                    label: 'Diğerlerini Gizle',
                    accelerator: 'Command+Shift+H',
                    role: 'hideothers'
                },
                {
                    label: 'Tümünü Göster',
                    role: 'unhide'
                },
                { type: 'separator' },
                {
                    label: 'Çıkış',
                    accelerator: 'Command+Q',
                    click: () => {
                        app.isQuitting = true;
                        app.quit();
                    }
                }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// Uygulama hazır olduğunda
app.whenReady().then(() => {
    createWindow();
    createTray();
    createMenu();

    // macOS'ta dock ikonuna tıklandığında pencereyi yeniden oluştur
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
            // macOS'ta dock'ı tekrar göster
            if (process.platform === 'darwin' && app.dock) {
                app.dock.show();
            }
        }
    });
});

// Tüm pencereler kapatıldığında
app.on('window-all-closed', () => {
    // macOS'ta uygulamalar genellikle açık kalır
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Uygulama kapatılırken temizlik
app.on('before-quit', (event) => {
    console.log('🛑 Uygulama kapatılıyor...');
    app.isQuitting = true;
    
    // Web sunucu process'ini kapat
    if (webServerProcess) {
        console.log('🛑 Web sunucusu kapatılıyor...');
        webServerProcess.kill('SIGTERM');
    }
});

// Tek instance kontrolü
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('⚠️  APRS Position Sender zaten çalışıyor!');
    app.quit();
} else {
    app.on('second-instance', () => {
        // İkinci instance çalıştırılırsa mevcut pencereyi ön plana getir
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

// IPC Handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('show-about-dialog', () => {
    return dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'APRS Position Sender Hakkında',
        message: 'APRS Position Sender',
        detail: `Versiyon: ${app.getVersion()}
Uygulamayı Geliştiren
Mustafa Genç
eposta@mustafagenc.info
APRS Position Sender with Desktop Integration

Bu uygulama amatör telsiz operatörleri için geliştirilmiştir.`,
        buttons: ['Tamam']
    });
});

ipcMain.handle('open-external', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { success: true };
    } catch (error) {
        console.error('❌ Harici URL açma hatası:', error);
        return { success: false, error: error.message };
    }
});

console.log('🚀 APRS Position Sender başlatılıyor...');
