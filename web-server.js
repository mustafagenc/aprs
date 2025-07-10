const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

// Config dosyası yönetimi
let configPath;
let userConfigPath;

// Electron modunda config dosyasını kullanıcı dizinine kopyala
if (process.env.ELECTRON_MODE === 'true') {
    // Electron modunda, ana process'ten userDataPath gelecek
    const userDataPath = process.env.USER_DATA_PATH;
    if (userDataPath) {
        userConfigPath = path.join(userDataPath, 'config.env');
        configPath = userConfigPath;
    } else {
        // Fallback olarak home directory kullan
        const userHome = os.homedir();
        userConfigPath = path.join(userHome, '.aprs-config.env');
        configPath = userConfigPath;
    }
} else {
    // Normal modda proje dizinindeki .env dosyasını kullan
    configPath = path.join(__dirname, '.env');
}

// Config dosyasını initialize et
function initializeConfig() {
    const defaultConfigPath = path.join(__dirname, '.env');
    console.log(`🔧 Config initialize - Default path: ${defaultConfigPath}`);
    console.log(`🔧 Config initialize - User path: ${userConfigPath}`);
    
    // Kullanıcı config dosyası yoksa varsayılan dosyayı kopyala
    if (userConfigPath && !fs.existsSync(userConfigPath)) {
        console.log(`📝 User config dosyası bulunamadı, oluşturuluyor...`);
        try {
            if (fs.existsSync(defaultConfigPath)) {
                fs.copyFileSync(defaultConfigPath, userConfigPath);
                console.log(`✅ Config dosyası kopyalandı: ${userConfigPath}`);
            } else {
                console.log(`⚠️ Varsayılan config dosyası bulunamadı, yeni oluşturuluyor...`);
                // Varsayılan config dosyası yoksa boş bir dosya oluştur
                const defaultConfig = `CALLSIGN="N0CALL"
LATITUDE="0.0"
LONGITUDE="0.0"
COMMENT="APRS Position Sender"
SYMBOL="/>"
APRS_PATH="APRS"
AUTO_SEND_ENABLED="false"
AUTO_SEND_INTERVAL="600"
AUTO_SEND_COUNT="10"
DEMO_MODE="false"`;
                fs.writeFileSync(userConfigPath, defaultConfig);
                console.log(`✅ Varsayılan config dosyası oluşturuldu: ${userConfigPath}`);
            }
        } catch (error) {
            console.error('❌ Config dosyası kopyalanırken hata:', error.message);
        }
    } else if (userConfigPath) {
        console.log(`✅ User config dosyası mevcut: ${userConfigPath}`);
    }
}

// Config'i yükle
function loadConfig() {
    console.log(`🔧 Config yükleniyor - ELECTRON_MODE: ${process.env.ELECTRON_MODE}`);
    console.log(`📁 Config path: ${configPath}`);
    console.log(`📁 User config path: ${userConfigPath}`);
    
    // Config dosyasını initialize et
    initializeConfig();
    
    // Config dosyasını dotenv ile yükle
    require('dotenv').config({ path: configPath });
    
    console.log(`✅ Config yüklendi - CALLSIGN: ${process.env.CALLSIGN}`);
}

// Config'i yükle
loadConfig();

// APRS sınıflarını import et
const { APRSPositionSender, APRSISClient, calculatePasscode } = require('./index.js');

// Electron modu kontrolü
const isElectronMode = process.env.ELECTRON_MODE === 'true';

// Node.js executable path'ini belirle
function getNodePath() {
    if (isElectronMode) {
        // Electron ortamında process.execPath'i kullan
        return process.execPath;
    } else {
        // Normal ortamda node komutunu kullan
        return 'node';
    }
}

// Güvenli spawn fonksiyonu
function safeSpawn(command, args, options = {}) {
    if (isElectronMode) {
        // Electron ortamında, fork kullanarak child process oluştur
        const { fork } = require('child_process');
        
        // args'dan 'node' ve script adını ayır
        const scriptName = args[0]; // 'index.js'
        const scriptArgs = args.slice(1); // ['--auto'] gibi
        
        // Script yolunu belirle - Electron packaged app'te doğru çalışması için
        let scriptPath;
        const appPath = process.env.APP_PATH || __dirname;
        
        // Packaged app detection
        const isPackaged = process.env.APP_PATH && (
            process.env.APP_PATH.includes('app.asar') || 
            process.env.APP_PATH.includes('Resources/app')
        );
        
        console.log(`🔧 Script path detection:`);
        console.log(`   appPath: ${appPath}`);
        console.log(`   isPackaged: ${isPackaged}`);
        console.log(`   __dirname: ${__dirname}`);
        
        if (isPackaged) {
            // Packaged app - app.asar içindeki dosyalar
            scriptPath = path.join(appPath, scriptName);
        } else if (process.env.APP_PATH) {
            // Environment'tan gelen app path
            scriptPath = path.join(process.env.APP_PATH, scriptName);
        } else {
            // Development mode - normal __dirname
            scriptPath = path.join(__dirname, scriptName);
        }
        
        // Eğer script bulunamazsa farklı yolları dene
        if (!fs.existsSync(scriptPath)) {
            console.log(`⚠️ Script not found at: ${scriptPath}`);
            
            const fallbackPaths = [
                path.join(__dirname, scriptName),
                path.join(appPath, scriptName),
                path.join(process.cwd(), scriptName)
            ];
            
            for (const fallbackPath of fallbackPaths) {
                console.log(`🔍 Trying fallback: ${fallbackPath}, exists: ${fs.existsSync(fallbackPath)}`);
                if (fs.existsSync(fallbackPath)) {
                    scriptPath = fallbackPath;
                    break;
                }
            }
        }
        
        console.log(`🔧 Electron modunda fork işlemi başlatılıyor:`);
        console.log(`   Script: ${scriptPath}`);
        console.log(`   Args: ${scriptArgs.join(' ')}`);
        console.log(`   CWD: ${options.cwd || __dirname}`);
        console.log(`   Script exists: ${fs.existsSync(scriptPath)}`);
        
        // Script dosyasının varlığını kontrol et
        if (!fs.existsSync(scriptPath)) {
            const error = new Error(`Script not found: ${scriptPath}`);
            console.error(`❌ ${error.message}`);
            throw error;
        }
        
        const childProcess = fork(scriptPath, scriptArgs, {
            cwd: process.env.APP_PATH || __dirname,
            silent: false, // Logging için false yap
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'], // IPC channel eklendi
            env: { ...process.env, ...options.env },
            execArgv: [] // Parent process'in node flags'lerini kopyalama
        });
        
        // Child process error handling
        childProcess.on('error', (err) => {
            console.error(`❌ Child process error (${scriptName}):`, err);
        });
        
        childProcess.on('exit', (code, signal) => {
            if (signal) {
                console.log(`⚠️ Child process killed by signal: ${signal}`);
            } else if (code !== 0) {
                console.log(`⚠️ Child process exited with code: ${code}`);
            }
        });
        
        return childProcess;
    } else {
        // Normal ortamda spawn kullan
        const nodePath = getNodePath();
        return spawn(nodePath, args, options);
    }
}

// Package.json'dan versiyon bilgisini oku
let packageInfo = {};
try {
    const packageData = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
    packageInfo = JSON.parse(packageData);
} catch (error) {
    console.warn('Package.json okunamadı:', error.message);
    packageInfo = { name: 'APRS-FI', version: '1.0.0' };
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Electron modunda farklı log çıktısı
function log(message) {
    const timestamp = new Date().toISOString();
    if (isElectronMode) {
        console.log(`[${timestamp}] ${message}`);
    } else {
        console.log(message);
    }
}

// Log helper fonksiyonu - undefined döndürmesini engeller
function emitLog(type, message) {
    io.emit('log', { type, message });
    // Explicitly return void to prevent undefined in console
    return;
}

// Static dosyalar için middleware
app.use(express.static('public'));
app.use(express.json());

// Ana sayfa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// APRS konfigürasyon bilgilerini al
app.get('/api/config', (req, res) => {
    res.json({
        callsign: process.env.CALLSIGN || 'N/A',
        latitude: process.env.LATITUDE || 'N/A',
        longitude: process.env.LONGITUDE || 'N/A',
        comment: process.env.COMMENT || 'N/A',
        symbol: process.env.SYMBOL || '/>',
        path: process.env.APRS_PATH || 'APRS',
        autoEnabled: process.env.AUTO_SEND_ENABLED === 'true',
        interval: process.env.AUTO_SEND_INTERVAL || '600',
        count: process.env.AUTO_SEND_COUNT || '10',
        demoMode: process.env.DEMO_MODE === 'true',
        demoMessage: process.env.DEMO_MESSAGE || 'Bu demo sürümüdür.',
        version: packageInfo.version || '1.0.0',
        appName: packageInfo.name || 'APRS Position Sender',
        isElectron: isElectronMode
    });
});

// Config güncelleme endpoint'i
app.post('/api/config', (req, res) => {
    try {
        const {
            callsign,
            latitude,
            longitude,
            comment,
            symbol,
            path,
            autoEnabled,
            interval,
            count,
            demoMode
        } = req.body;

        // Config dosyasını oku
        let configContent = '';
        if (fs.existsSync(configPath)) {
            configContent = fs.readFileSync(configPath, 'utf8');
        }

        // Mevcut değerleri güncelle
        const configMap = {};
        
        // Mevcut config'i parse et
        configContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    configMap[key] = value;
                }
            }
        });

        // Yeni değerleri güncelle
        if (callsign !== undefined) configMap['CALLSIGN'] = callsign;
        if (latitude !== undefined) configMap['LATITUDE'] = latitude;
        if (longitude !== undefined) configMap['LONGITUDE'] = longitude;
        if (comment !== undefined) configMap['COMMENT'] = comment;
        if (symbol !== undefined) configMap['SYMBOL'] = symbol;
        if (path !== undefined) configMap['APRS_PATH'] = path;
        if (autoEnabled !== undefined) configMap['AUTO_SEND_ENABLED'] = autoEnabled.toString();
        if (interval !== undefined) configMap['AUTO_SEND_INTERVAL'] = interval;
        if (count !== undefined) configMap['AUTO_SEND_COUNT'] = count;
        if (demoMode !== undefined) configMap['DEMO_MODE'] = demoMode.toString();

        // Config dosyasını yeniden oluştur
        let newConfigContent = '';
        for (const [key, value] of Object.entries(configMap)) {
            newConfigContent += `${key}="${value}"\n`;
        }

        // Dosyayı yaz
        fs.writeFileSync(configPath, newConfigContent);

        // Environment variables'ı güncelle
        for (const [key, value] of Object.entries(configMap)) {
            process.env[key] = value;
        }

        log('Config güncellendi: ' + configPath);
        res.json({ success: true, message: 'Konfigürasyon başarıyla güncellendi' });
    } catch (error) {
        console.error('Config güncellenirken hata:', error);
        res.status(500).json({ success: false, message: 'Konfigürasyon güncellenirken hata oluştu' });
    }
});

// Aktif process'ler
let activeProcesses = {
    auto: null,
    send: null
};

// Socket.IO bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('🌐 Web arayüzü bağlandı:', socket.id);
    
    // Socket error handling
    socket.on('error', (error) => {
        console.error('Socket hatası:', error);
    });
    
    // Konfigürasyonu gönder
    socket.emit('config', {
        callsign: process.env.CALLSIGN || 'N/A',
        latitude: process.env.LATITUDE || 'N/A',
        longitude: process.env.LONGITUDE || 'N/A',
        comment: process.env.COMMENT || 'N/A',
        symbol: process.env.SYMBOL || '/>',
        path: process.env.APRS_PATH || 'APRS',
        autoEnabled: process.env.AUTO_SEND_ENABLED === 'true',
        interval: process.env.AUTO_SEND_INTERVAL || '600',
        count: process.env.AUTO_SEND_COUNT || '10',
        demoMode: process.env.DEMO_MODE === 'true',
        demoMessage: process.env.DEMO_MESSAGE || 'Bu demo sürümüdür.',
        version: packageInfo.version || '1.0.0',
        appName: packageInfo.name || 'APRS-FI',
        isElectron: isElectronMode
    });
    
    // Eğer otomatik process çalışıyorsa bunu bildir
    if (activeProcesses.auto) {
        socket.emit('log', { type: 'info', message: '🤖 Otomatik gönderim arka planda çalışıyor...' });
        socket.emit('log', { type: 'info', message: '📊 AUTO_START_ON_DEPLOY ile başlatıldı' });
    }

    // Otomatik gönderim başlat
    socket.on('start-auto', () => {
        try {
            // Demo mode kontrolü
            if (process.env.DEMO_MODE === 'true') {
                socket.emit('log', { 
                    type: 'warning', 
                    message: `🚫 ${process.env.DEMO_MESSAGE || 'Bu demo sürümüdür. APRS gönderimi devre dışıdır.'}` 
                });
                return;
            }

            if (activeProcesses.auto) {
                socket.emit('log', { type: 'warning', message: '⚠️ Otomatik gönderim zaten çalışıyor!' });
                return;
            }

            socket.emit('log', { type: 'info', message: '🚀 Otomatik gönderim başlatılıyor...' });
            
            activeProcesses.auto = safeSpawn('node', ['index.js', '--auto'], {
                cwd: process.env.APP_PATH || __dirname
            });

            // Process error handling
            activeProcesses.auto.on('error', (err) => {
                console.error('❌ Auto process error:', err);
                io.emit('log', { type: 'error', message: `❌ Process hatası: ${err.message}` });
                activeProcesses.auto = null;
                io.emit('status', { auto: false, send: false });
            });

            activeProcesses.auto.stdout.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    io.emit('log', { type: 'info', message: message }); // Sadece tüm client'lara gönder
                }
            });

            activeProcesses.auto.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    io.emit('log', { type: 'error', message: `❌ ${message}` });
                }
            });

            activeProcesses.auto.on('close', (code, signal) => {
                activeProcesses.auto = null;
                let message;
                if (signal) {
                    message = `🏁 Otomatik gönderim durduruldu (Signal: ${signal})`;
                } else {
                    message = `🏁 Otomatik gönderim tamamlandı (Exit code: ${code})`;
                }
                io.emit('log', { type: 'info', message: message });
                io.emit('status', { auto: false, send: false });
            });

            // Process başlatıldığında durum güncelle
            io.emit('status', { auto: true, send: false });
            
        } catch (error) {
            console.error('❌ start-auto error:', error);
            socket.emit('log', { type: 'error', message: `❌ Otomatik gönderim başlatılamadı: ${error.message}` });
            activeProcesses.auto = null;
            io.emit('status', { auto: false, send: false });
        }
    });

    // Tek gönderim
    socket.on('send-once', () => {
        try {
            // Demo mode kontrolü
            if (process.env.DEMO_MODE === 'true') {
                socket.emit('log', { 
                    type: 'warning', 
                    message: `🚫 ${process.env.DEMO_MESSAGE || 'Bu demo sürümüdür. APRS gönderimi devre dışıdır.'}` 
                });
                return;
            }

            if (activeProcesses.send) {
                socket.emit('log', { type: 'warning', message: '⚠️ Gönderim zaten çalışıyor!' });
                return;
            }

            socket.emit('log', { type: 'info', message: '📡 Tek gönderim başlatılıyor...' });
            
            activeProcesses.send = safeSpawn('node', ['index.js', '--send'], {
                cwd: process.env.APP_PATH || __dirname
            });

            // Process error handling
            activeProcesses.send.on('error', (err) => {
                console.error('❌ Send process error:', err);
                io.emit('log', { type: 'error', message: `❌ Gönderim hatası: ${err.message}` });
                activeProcesses.send = null;
                io.emit('status', { auto: !!activeProcesses.auto, send: false });
            });

            activeProcesses.send.stdout.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    io.emit('log', { type: 'info', message: message });
                }
            });

            activeProcesses.send.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    io.emit('log', { type: 'error', message: `❌ ${message}` });
                }
            });

            activeProcesses.send.on('close', (code, signal) => {
                activeProcesses.send = null;
                let message;
                if (signal) {
                    message = `✅ Tek gönderim durduruldu (Signal: ${signal})`;
                } else {
                    message = `✅ Tek gönderim tamamlandı (Exit code: ${code})`;
                }
                io.emit('log', { type: 'info', message: message });
                io.emit('status', { auto: !!activeProcesses.auto, send: false });
            });

            io.emit('status', { auto: !!activeProcesses.auto, send: true });
            
        } catch (error) {
            console.error('❌ send-once error:', error);
            socket.emit('log', { type: 'error', message: `❌ Tek gönderim başlatılamadı: ${error.message}` });
            activeProcesses.send = null;
            io.emit('status', { auto: !!activeProcesses.auto, send: false });
        }
    });

    // Process'leri durdur
    socket.on('stop-auto', () => {
        if (activeProcesses.auto) {
            activeProcesses.auto.kill('SIGINT');
            io.emit('log', { type: 'warning', message: '🛑 Otomatik gönderim durduruldu' });
        }
    });

    // Log'ları temizle
    socket.on('clear-logs', () => {
        io.emit('clear-logs');
    });

    // Durum bilgisi gönder
    socket.on('send-status', () => {
        try {
            // Demo mode kontrolü
            if (process.env.DEMO_MODE === 'true') {
                socket.emit('log', { 
                    type: 'warning', 
                    message: `🚫 ${process.env.DEMO_MESSAGE || 'Bu demo sürümüdür. APRS gönderimi devre dışıdır.'}` 
                });
                return;
            }

            socket.emit('log', { type: 'info', message: '📢 Durum bilgisi gönderiliyor...' });
            
            const statusProcess = safeSpawn('node', ['index.js', '--status'], {
                cwd: process.env.APP_PATH || __dirname
            });

            // Process error handling
            statusProcess.on('error', (err) => {
                console.error('❌ Status process error:', err);
                io.emit('log', { type: 'error', message: `❌ Durum gönderim hatası: ${err.message}` });
            });

            statusProcess.stdout.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    io.emit('log', { type: 'info', message: message });
                }
            });

            statusProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message) {
                    io.emit('log', { type: 'error', message: `❌ ${message}` });
                }
            });

            statusProcess.on('close', (code, signal) => {
                let message;
                if (signal) {
                    message = `📢 Durum gönderimi durduruldu (Signal: ${signal})`;
                } else {
                    message = `📢 Durum gönderimi tamamlandı (Exit code: ${code})`;
                }
                io.emit('log', { type: 'info', message: message });
            });
            
        } catch (error) {
            console.error('❌ send-status error:', error);
            socket.emit('log', { type: 'error', message: `❌ Durum gönderimi başlatılamadı: ${error.message}` });
        }
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', (reason) => {
        console.log(`🌐 Web arayüzü bağlantısı kesildi: ${socket.id} - Neden: ${reason}`);
        
        // Bağlantı kopma nedenini logla
        if (reason === 'io server disconnect') {
            console.log('⚠️ Sunucu tarafından bağlantı kapatıldı');
        } else if (reason === 'io client disconnect') {
            console.log('⚠️ İstemci tarafından bağlantı kapatıldı');
        } else if (reason === 'ping timeout') {
            console.log('⚠️ Ping timeout - bağlantı zaman aşımı');
        } else if (reason === 'transport close') {
            console.log('⚠️ Transport kapandı');
        } else if (reason === 'transport error') {
            console.log('⚠️ Transport hatası');
        } else {
            console.log(`⚠️ Bilinmeyen neden: ${reason}`);
        }
    });

    // Bağlantı hatası durumunda
    socket.on('connect_error', (error) => {
        console.error('🔌 Socket bağlantı hatası:', error);
    });

    // Mevcut durum bilgisi gönder
    socket.emit('status', { 
        auto: !!activeProcesses.auto, 
        send: !!activeProcesses.send 
    });
});

// Durum gönderimi endpoint'i
app.post('/send-status', async (req, res) => {
    try {
        if (process.env.DEMO_MODE === 'true') {
            emitLog('warning', '⚠️ Demo modunda - durum paketi simülasyonu');
            
            const sender = new APRSPositionSender();
            const packet = sender.sendStatusFromEnv();
            
            if (packet) {
                emitLog('info', `📢 Demo Durum Paketi: ${packet}`);
                res.json({ success: true, message: 'Demo durum paketi oluşturuldu', packet });
            } else {
                res.json({ success: false, message: 'Durum paketi oluşturulamadı' });
            }
            return;
        }

        emitLog('info', '🚀 Durum paketi gönderimi başlatıldı...');
        
        const sender = new APRSPositionSender();
        const success = await sender.sendStatusToAPRSIS();
        
        if (success) {
            emitLog('success', '✅ Durum paketi başarıyla gönderildi!');
            res.json({ success: true, message: 'Durum paketi gönderildi' });
        } else {
            emitLog('error', '❌ Durum paketi gönderilemedi');
            res.json({ success: false, message: 'Durum paketi gönderilemedi' });
        }
    } catch (error) {
        emitLog('error', `❌ Durum gönderim hatası: ${error.message}`);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Web server kapatılıyor...');
    
    // Aktif process'leri temizle
    Object.values(activeProcesses).forEach(proc => {
        if (proc) {
            proc.kill('SIGINT');
        }
    });
    
    server.close(() => {
        console.log('✅ Web server kapatıldı');
        process.exit(0);
    });
});

server.listen(PORT, () => {
    if (isElectronMode) {
        console.log(`🖥️  APRS-FI Desktop sunucusu başlatıldı: http://localhost:${PORT}`);
        console.log(`📡 Electron modu aktif - Desktop uygulaması hazır`);
    } else {
        console.log(`🌐 APRS Web Arayüzü çalışıyor: http://localhost:${PORT}`);
        console.log(`📡 APRS gönderimlerini web üzerinden kontrol edebilirsiniz`);
    }
    
    // Environment variables debug
    console.log(`🔍 AUTO_START_ON_DEPLOY: ${process.env.AUTO_START_ON_DEPLOY}`);
    console.log(`🔍 DEMO_MODE: ${process.env.DEMO_MODE}`);
    console.log(`🔍 CALLSIGN: ${process.env.CALLSIGN}`);
    console.log(`🔍 ELECTRON_MODE: ${isElectronMode}`);
    
    // Sunucu başlarken otomatik gönderimi başlat
    if (process.env.AUTO_START_ON_DEPLOY === 'true') {
        console.log('🚀 AUTO_START_ON_DEPLOY aktif - Otomatik gönderim başlatılıyor...');
        
        // Demo mode kontrolü - uyarı ver ama devam et
        if (process.env.DEMO_MODE === 'true') {
            console.log(`🚫 Demo Mode aktif: ${process.env.DEMO_MESSAGE || 'APRS gönderimi devre dışıdır.'}`);
            console.log('⚠️ Demo mode aktif olmasına rağmen AUTO_START_ON_DEPLOY nedeniyle gönderim başlatılıyor...');
        }
        
        // Otomatik gönderimi başlat (her durumda)
        setTimeout(() => {
            if (!activeProcesses.auto) {
                console.log('📡 Deployment sonrası otomatik APRS gönderimi başlatılıyor...');
                
                try {
                    activeProcesses.auto = safeSpawn('node', ['index.js', '--auto'], {
                        cwd: process.env.APP_PATH || __dirname
                    });

                    activeProcesses.auto.stdout.on('data', (data) => {
                        const message = data.toString().trim();
                        if (message) {
                            console.log(`[AUTO] ${message}`);
                            // Tüm bağlı socket'lere log gönder
                            io.emit('log', { type: 'info', message: `🤖 ${message}` });
                        }
                    });

                    activeProcesses.auto.stderr.on('data', (data) => {
                        const message = data.toString().trim();
                        if (message) {
                            console.error(`[AUTO ERROR] ${message}`);
                            io.emit('log', { type: 'error', message: `❌ ${message}` });
                        }
                    });

                    activeProcesses.auto.on('close', (code) => {
                        console.log(`[AUTO] Process kapandı - kod: ${code}`);
                        activeProcesses.auto = null;
                        io.emit('log', { type: 'warning', message: `⚠️ Otomatik gönderim durdu (kod: ${code})` });
                        io.emit('status', { auto: false, send: false });
                    });

                    activeProcesses.auto.on('error', (error) => {
                        console.error(`[AUTO ERROR] Process hatası:`, error);
                        activeProcesses.auto = null;
                        io.emit('log', { type: 'error', message: `❌ Otomatik gönderim hatası: ${error.message}` });
                        io.emit('status', { auto: false, send: false });
                    });
                    
                    // Status güncelle
                    io.emit('status', { auto: true, send: false });
                    io.emit('log', { type: 'info', message: '🚀 Deployment sonrası otomatik gönderim başlatıldı!' });
                    console.log('✅ Auto start process başarıyla oluşturuldu');
                    
                } catch (error) {
                    console.error('❌ Auto start spawn hatası:', error);
                    io.emit('log', { type: 'error', message: `❌ Auto start hatası: ${error.message}` });
                }
            } else {
                console.log('⚠️ Auto process zaten çalışıyor, yeni başlatılmadı');
            }
        }, 2000); // 2 saniye bekle ki server tamamen hazır olsun
    } else {
        console.log('ℹ️ AUTO_START_ON_DEPLOY false veya tanımlı değil - otomatik başlatma yok');
    }
});
