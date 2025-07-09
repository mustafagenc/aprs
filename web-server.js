const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
require('dotenv').config();

// APRS sınıflarını import et
const { APRSPositionSender, APRSISClient, calculatePasscode } = require('./index.js');

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
        appName: packageInfo.name || 'APRS-FI'
    });
});

// Aktif process'ler
let activeProcesses = {
    auto: null,
    send: null
};

// Socket.IO bağlantı yönetimi
io.on('connection', (socket) => {
    console.log('🌐 Web arayüzü bağlandı:', socket.id);
    
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
        appName: packageInfo.name || 'APRS-FI'
    });
    
    // Eğer otomatik process çalışıyorsa bunu bildir
    if (activeProcesses.auto) {
        socket.emit('log', { type: 'info', message: '🤖 Otomatik gönderim arka planda çalışıyor...' });
        socket.emit('log', { type: 'info', message: '📊 AUTO_START_ON_DEPLOY ile başlatıldı' });
    }

    // Otomatik gönderim başlat
    socket.on('start-auto', () => {
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
        
        activeProcesses.auto = spawn('node', ['index.js', '--auto'], {
            cwd: __dirname
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

        activeProcesses.auto.on('close', (code) => {
            activeProcesses.auto = null;
            const message = `🏁 Otomatik gönderim tamamlandı (Exit code: ${code})`;
            io.emit('log', { type: 'info', message: message });
            io.emit('status', { auto: false, send: false });
        });

        io.emit('status', { auto: true, send: false });
    });

    // Tek gönderim
    socket.on('send-once', () => {
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
        
        activeProcesses.send = spawn('node', ['index.js', '--send'], {
            cwd: __dirname
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

        activeProcesses.send.on('close', (code) => {
            activeProcesses.send = null;
            const message = `✅ Tek gönderim tamamlandı (Exit code: ${code})`;
            io.emit('log', { type: 'info', message: message });
            io.emit('status', { auto: !!activeProcesses.auto, send: false });
        });

        io.emit('status', { auto: !!activeProcesses.auto, send: true });
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
        // Demo mode kontrolü
        if (process.env.DEMO_MODE === 'true') {
            socket.emit('log', { 
                type: 'warning', 
                message: `🚫 ${process.env.DEMO_MESSAGE || 'Bu demo sürümüdür. APRS gönderimi devre dışıdır.'}` 
            });
            return;
        }

        socket.emit('log', { type: 'info', message: '📢 Durum bilgisi gönderiliyor...' });
        
        const statusProcess = spawn('node', ['index.js', '--status'], {
            cwd: __dirname
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

        statusProcess.on('close', (code) => {
            const message = `📢 Durum gönderimi tamamlandı (Exit code: ${code})`;
            io.emit('log', { type: 'info', message: message });
        });
    });

    // Bağlantı koptuğunda
    socket.on('disconnect', () => {
        console.log('🌐 Web arayüzü bağlantısı kesildi:', socket.id);
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
    console.log(`🌐 APRS Web Arayüzü çalışıyor: http://localhost:${PORT}`);
    console.log(`📡 APRS gönderimlerini web üzerinden kontrol edebilirsiniz`);
    
    // Environment variables debug
    console.log(`🔍 AUTO_START_ON_DEPLOY: ${process.env.AUTO_START_ON_DEPLOY}`);
    console.log(`🔍 DEMO_MODE: ${process.env.DEMO_MODE}`);
    console.log(`🔍 CALLSIGN: ${process.env.CALLSIGN}`);
    
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
                    activeProcesses.auto = spawn('node', ['index.js', '--auto'], {
                        cwd: __dirname,
                        stdio: ['pipe', 'pipe', 'pipe']
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
