const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
require('dotenv').config();

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

const PORT = process.env.WEB_PORT || 3000;

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
        autoEnabled: process.env.AUTO_SEND_ENABLED === 'true',
        interval: process.env.AUTO_SEND_INTERVAL || '600',
        count: process.env.AUTO_SEND_COUNT || '10',
        demoMode: process.env.DEMO_MODE === 'true',
        demoMessage: process.env.DEMO_MESSAGE || 'Bu demo sürümüdür.',
        version: packageInfo.version || '1.0.0',
        appName: packageInfo.name || 'APRS-FI'
    });

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
                socket.emit('log', { type: 'info', message: message });
                io.emit('log', { type: 'info', message: message }); // Tüm client'lara gönder
            }
        });

        activeProcesses.auto.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
                socket.emit('log', { type: 'error', message: `❌ ${message}` });
                io.emit('log', { type: 'error', message: `❌ ${message}` });
            }
        });

        activeProcesses.auto.on('close', (code) => {
            activeProcesses.auto = null;
            const message = `🏁 Otomatik gönderim tamamlandı (Exit code: ${code})`;
            socket.emit('log', { type: 'info', message: message });
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
                socket.emit('log', { type: 'info', message: message });
                io.emit('log', { type: 'info', message: message });
            }
        });

        activeProcesses.send.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (message) {
                socket.emit('log', { type: 'error', message: `❌ ${message}` });
                io.emit('log', { type: 'error', message: `❌ ${message}` });
            }
        });

        activeProcesses.send.on('close', (code) => {
            activeProcesses.send = null;
            const message = `✅ Tek gönderim tamamlandı (Exit code: ${code})`;
            socket.emit('log', { type: 'info', message: message });
            io.emit('log', { type: 'info', message: message });
            io.emit('status', { auto: !!activeProcesses.auto, send: false });
        });

        io.emit('status', { auto: !!activeProcesses.auto, send: true });
    });

    // Process'leri durdur
    socket.on('stop-auto', () => {
        if (activeProcesses.auto) {
            activeProcesses.auto.kill('SIGINT');
            socket.emit('log', { type: 'warning', message: '🛑 Otomatik gönderim durduruldu' });
            io.emit('log', { type: 'warning', message: '🛑 Otomatik gönderim durduruldu' });
        }
    });

    // Log'ları temizle
    socket.on('clear-logs', () => {
        io.emit('clear-logs');
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
});
