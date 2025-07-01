const net = require('net');
require('dotenv').config();

// Log wrapper - sadece console'a yaz (web-server.js zaten stdout'u yakalıyor)
function log(message) {
    console.log(message);
}

function logError(message) {
    console.error(message);
}

// APRS-IS Client
class APRSISClient {
    constructor(server, port, callsign, passcode) {
        this.server = server;
        this.port = port;
        this.callsign = callsign;
        this.passcode = passcode;
        this.socket = null;
        this.connected = false;
    }

    /**
     * APRS-IS sunucusuna bağlan
     */
    connect() {
        return new Promise((resolve, reject) => {
            log(`🔗 APRS-IS sunucusuna bağlanılıyor: ${this.server}:${this.port}`);
            
            this.socket = new net.Socket();
            
            this.socket.connect(this.port, this.server, () => {
                log('✅ APRS-IS sunucusuna bağlandı');
                this.connected = true;
                
                // Login paketi gönder
                const loginPacket = `user ${this.callsign} pass ${this.passcode} vers NodeAPRS 1.0\r\n`;
                this.socket.write(loginPacket);
                log(`📤 Login paketi gönderildi: ${loginPacket.trim()}`);
            });

            this.socket.on('data', (data) => {
                const message = data.toString().trim();
                log(`📥 Sunucudan gelen: ${message}`);
                
                if (message.includes('verified')) {
                    log('✅ Giriş doğrulandı - gönderim izni var');
                    resolve(true);
                } else if (message.includes('unverified')) {
                    log('⚠️  Giriş doğrulanmadı - sadece dinleme modu');
                    resolve(false);
                }
            });

            this.socket.on('error', (err) => {
                logError('❌ Bağlantı hatası:', err.message);
                reject(err);
            });

            this.socket.on('close', () => {
                log('🔌 APRS-IS bağlantısı kapandı');
                this.connected = false;
            });

            // Timeout ekle
            setTimeout(() => {
                if (!this.connected) {
                    reject(new Error('Bağlantı zaman aşımı'));
                }
            }, 10000);
        });
    }

    /**
     * APRS paketi gönder
     */
    sendPacket(packet) {
        if (!this.connected || !this.socket) {
            throw new Error('APRS-IS bağlantısı yok');
        }

        const packetWithNewline = packet + '\r\n';
        this.socket.write(packetWithNewline);
        log(`📡 Paket gönderildi: ${packet}`);
    }

    /**
     * Bağlantıyı kapat
     */
    disconnect() {
        if (this.socket) {
            this.socket.end();
            log('🔌 APRS-IS bağlantısı kapatıldı');
        }
    }
}

// APRS paket gönderme sınıfı
class APRSPositionSender {
    /**
     * APRS pozisyon paketi oluştur
     * @param {string} callsign - Çağrı işareti
     * @param {number} lat - Enlem
     * @param {number} lng - Boylam
     * @param {string} comment - Yorum (opsiyonel)
     * @param {string} symbol - APRS sembolü (opsiyonel)
     * @returns {string} - APRS paketi
     */
    createPositionPacket(callsign, lat, lng, comment = '', symbol = '/>') {
        // Enlem ve boylamı APRS formatına çevir
        const latDeg = Math.floor(Math.abs(lat));
        const latMin = (Math.abs(lat) - latDeg) * 60;
        const latDir = lat >= 0 ? 'N' : 'S';
        
        const lngDeg = Math.floor(Math.abs(lng));
        const lngMin = (Math.abs(lng) - lngDeg) * 60;
        const lngDir = lng >= 0 ? 'E' : 'W';

        const latStr = `${latDeg.toString().padStart(2, '0')}${latMin.toFixed(2).padStart(5, '0')}${latDir}`;
        const lngStr = `${lngDeg.toString().padStart(3, '0')}${lngMin.toFixed(2).padStart(5, '0')}${lngDir}`;

        // APRS pozisyon paketi formatı
        const packet = `${callsign}>APRS:=${latStr}${symbol[0]}${lngStr}${symbol[1]}${comment}`;
        
        return packet;
    }

    /**
     * Konum gönderimi (.env dosyasından bilgileri alarak) - Gerçek gönderim
     */
    async sendPositionToAPRSIS() {
        const callsign = process.env.CALLSIGN;
        const latitude = parseFloat(process.env.LATITUDE);
        const longitude = parseFloat(process.env.LONGITUDE);
        const comment = process.env.COMMENT || '';
        const symbol = process.env.SYMBOL || '/>';
        const server = process.env.APRS_IS_SERVER || 'euro.aprs2.net';
        const port = parseInt(process.env.APRS_IS_PORT) || 14580;
        const passcode = process.env.APRS_IS_PASSCODE || '-1';

        // Gerekli bilgileri kontrol et
        if (!callsign) {
            logError('❌ CALLSIGN .env dosyasında bulunamadı!');
            return false;
        }

        if (isNaN(latitude) || isNaN(longitude)) {
            logError('❌ LATITUDE veya LONGITUDE .env dosyasında hatalı!');
            return false;
        }

        log('🚀 APRS-IS Gerçek Gönderim Başlatılıyor...');

        const packet = this.createPositionPacket(callsign, latitude, longitude, comment, symbol);
        
        log('📋 Gönderilecek Paket Bilgileri:');
        log('=====================================');
        log(`📍 İstasyon: ${callsign}`);
        log(`🌍 Konum: ${latitude}°, ${longitude}°`);
        log(`💬 Yorum: ${comment || 'Yok'}`);
        log(`🔣 Sembol: ${symbol}`);
        log(`📦 Paket: ${packet}`);
        log('=====================================');

        // APRS-IS bağlantısı kur
        const client = new APRSISClient(server, port, callsign, passcode);

        try {
            const verified = await client.connect();
            
            if (passcode === '-1') {
                log('⚠️  PASSCODE ayarlanmamış (-1)');
                log('ℹ️  Sadece dinleme modu - paket gönderilmeyecek');
                log('ℹ️  Gerçek gönderim için geçerli passcode gerekli');
                
                // Simülasyon olarak bekle
                await new Promise(resolve => setTimeout(resolve, 2000));
                client.disconnect();
                return false;
            }

            if (!verified) {
                log('⚠️  Giriş doğrulanmadı - paket gönderilmeyecek');
                client.disconnect();
                return false;
            }

            // Paketi gönder
            log('📡 Paket APRS ağına gönderiliyor...');
            client.sendPacket(packet);
            
            // Biraz bekle sonra bağlantıyı kapat
            await new Promise(resolve => setTimeout(resolve, 2000));
            client.disconnect();
            
            log('✅ Paket başarıyla APRS ağına gönderildi!');
            log('🌐 https://aprs.fi adresinden kontrol edebilirsiniz.');
            
            return true;

        } catch (error) {
            logError('❌ APRS-IS gönderim hatası:', error.message);
            client.disconnect();
            return false;
        }
    }

    /**
     * Konum gönderimi (.env dosyasından bilgileri alarak) - Simülasyon
     */
    sendPositionFromEnv() {
        const callsign = process.env.CALLSIGN;
        const latitude = parseFloat(process.env.LATITUDE);
        const longitude = parseFloat(process.env.LONGITUDE);
        const comment = process.env.COMMENT || '';
        const symbol = process.env.SYMBOL || '/>';

        // Gerekli bilgileri kontrol et
        if (!callsign) {
            logError('❌ CALLSIGN .env dosyasında bulunamadı!');
            return null;
        }

        if (isNaN(latitude) || isNaN(longitude)) {
            logError('❌ LATITUDE veya LONGITUDE .env dosyasında hatalı!');
            log('Örnek: LATITUDE=41.01150, LONGITUDE=29.12550');
            return null;
        }

        const packet = this.createPositionPacket(callsign, latitude, longitude, comment, symbol);
        
        log('📡 APRS Pozisyon Paketi Oluşturuldu (Simülasyon)');
        log('=====================================');
        log(`📍 İstasyon: ${callsign}`);
        log(`🌍 Konum: ${latitude}°, ${longitude}°`);
        log(`💬 Yorum: ${comment || 'Yok'}`);
        log(`🔣 Sembol: ${symbol}`);
        log('=====================================');
        log(`📦 Paket: ${packet}`);
        log('=====================================');
        log('ℹ️  Bu simülasyon modu - gerçek gönderim için:');
        log('   node index.js --send');
        
        return packet;
    }
}

// Passcode hesaplama fonksiyonu
function calculatePasscode(callsign) {
    // APRS passcode algoritması
    const call = callsign.toUpperCase().split('-')[0]; // SSID'yi kaldır
    let hash = 0x73e2;
    
    for (let i = 0; i < call.length; i += 2) {
        hash ^= call.charCodeAt(i) << 8;
        if (i + 1 < call.length) {
            hash ^= call.charCodeAt(i + 1);
        }
    }
    
    return hash & 0x7fff;
}

// Ana fonksiyon
async function main() {
    const args = process.argv.slice(2);
    const shouldSend = args.includes('--send');
    const autoMode = args.includes('--auto');
    
    if (autoMode) {
        log('🔄 APRS Otomatik Gönderim Modu');
        await startAutoSending();
        return;
    }
    
    if (shouldSend) {
        log('🚀 APRS-IS Gerçek Gönderim Modu');
    } else {
        log('🚀 APRS Pozisyon Gönderici (Simülasyon Modu)');
    }
    
    const sender = new APRSPositionSender();
    
    if (shouldSend) {
        // Passcode kontrolü
        const callsign = process.env.CALLSIGN;
        const passcode = process.env.APRS_IS_PASSCODE;
        
        if (callsign && passcode === '-1') {
            const calculatedPasscode = calculatePasscode(callsign);
            log(`💡 ${callsign} için hesaplanan passcode: ${calculatedPasscode}`);
            log('⚠️  .env dosyasında APRS_IS_PASSCODE=-1 ayarlı');
            log('ℹ️  Gerçek gönderim için doğru passcode\'u ayarlayın:');
            log(`   APRS_IS_PASSCODE=${calculatedPasscode}`);
        }
        
        // Gerçek gönderim
        const success = await sender.sendPositionToAPRSIS();
        
        if (success) {
            log('✨ İşlem başarıyla tamamlandı!');
        } else {
            log('❌ Gönderim başarısız! Ayarları kontrol edin.');
        }
    } else {
        // Simülasyon modu
        const packet = sender.sendPositionFromEnv();
        
        if (packet) {
            log('✨ Paket oluşturuldu! (Simülasyon)');
            log('📡 Gerçek gönderim için: node index.js --send');
            log('🔄 Otomatik gönderim için: node index.js --auto');
        } else {
            log('❌ Paket oluşturulamadı! .env dosyasını kontrol edin.');
        }
    }
}

// Otomatik gönderim fonksiyonu
async function startAutoSending() {
    const autoEnabled = process.env.AUTO_SEND_ENABLED === 'true';
    const interval = parseInt(process.env.AUTO_SEND_INTERVAL) || 600; // 10 dakika varsayılan (sabit istasyon)
    const maxCount = parseInt(process.env.AUTO_SEND_COUNT) || 10;
    
    if (!autoEnabled) {
        log('⚠️  Otomatik gönderim .env dosyasında devre dışı');
        log('ℹ️  Etkinleştirmek için: AUTO_SEND_ENABLED=true');
        return;
    }

    // Minimum süre kontrolü
    if (interval < 60) {
        log('❌ Minimum gönderim aralığı 60 saniye olmalı!');
        log('ℹ️  Güvenlik için bu sınır konulmuştur.');
        return;
    }

    // Sabit istasyon için öneriler
    const stationType = interval >= 600 ? 'Sabit İstasyon' : interval >= 300 ? 'Yarı-Sabit' : 'Mobil/Test';
    const efficiency = interval >= 600 ? '🟢 Optimal' : interval >= 300 ? '🟡 İyi' : '🟠 Sık';

    log('📊 Sabit İstasyon - Otomatik Gönderim Ayarları:');
    log('===============================================');
    log(`🏠 İstasyon Tipi: ${stationType}`);
    log(`⏰ Aralık: ${interval} saniye (${Math.round(interval/60)} dakika)`);
    log(`📊 Verimlilik: ${efficiency}`);
    log(`🔢 Maksimum: ${maxCount} gönderim`);
    log(`🌍 Konum: ${process.env.LATITUDE}°, ${process.env.LONGITUDE}°`);
    log(`📡 Toplam Süre: ~${Math.round((maxCount * interval) / 60)} dakika`);
    log('===============================================');

    // Sabit istasyon için uyarılar
    if (interval < 300) {
        log('⚠️  DİKKAT: Sabit istasyon için 5 dakikadan kısa aralık önerilmez!');
        log('💡 Önerilen aralık: 10-30 dakika (600-1800 saniye)');
        log('⚠️  APRS ağını gereksiz yüklemeyin.');
        log('⚠️  Devam etmek için 10 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 10000));
    } else if (interval >= 600) {
        log('✅ Sabit istasyon için optimal aralık!');
        log('💡 APRS ağı dostu gönderim aralığı.');
        log('🌐 Ağ yükünü minimize ediyorsunuz.');
    }

    const sender = new APRSPositionSender();
    let sentCount = 0;
    let lastPacket = '';
    let startTime = new Date();

    log('🚀 Sabit istasyon otomatik gönderimi başlıyor...');

    const sendInterval = setInterval(async () => {
        try {
            // Paket oluştur
            const callsign = process.env.CALLSIGN;
            const latitude = parseFloat(process.env.LATITUDE);
            const longitude = parseFloat(process.env.LONGITUDE);
            const comment = process.env.COMMENT || '';
            const symbol = process.env.SYMBOL || '/>';
            
            const currentPacket = sender.createPositionPacket(callsign, latitude, longitude, comment, symbol);
            
            // Aynı paket tekrarını önle
            if (currentPacket === lastPacket) {
                log(`⏭️  [${sentCount + 1}/${maxCount}] Aynı paket - atlanıyor (${new Date().toLocaleTimeString()})`);
            } else {
                log(`📡 [${sentCount + 1}/${maxCount}] Gönderiliyor... (${new Date().toLocaleTimeString()})`);
                
                const success = await sender.sendPositionToAPRSIS();
                
                if (success) {
                    log(`✅ [${sentCount + 1}/${maxCount}] Başarıyla gönderildi!`);
                    lastPacket = currentPacket;
                } else {
                    log(`❌ [${sentCount + 1}/${maxCount}] Gönderim başarısız!`);
                }
            }
            
            sentCount++;
            
            // Maksimum sayıya ulaşıldıysa dur
            if (sentCount >= maxCount) {
                clearInterval(sendInterval);
                const endTime = new Date();
                const totalDuration = Math.round((endTime - startTime) / 1000 / 60);
                
                log('🏁 Sabit İstasyon Otomatik Gönderim Tamamlandı!');
                log('===============================================');
                log(`📊 Toplam Gönderim: ${sentCount} paket`);
                log(`⏱️  Toplam Süre: ${totalDuration} dakika`);
                log(`📡 Ortalama Aralık: ${Math.round(totalDuration / sentCount)} dakika/paket`);
                log(`🌐 APRS.fi kontrolü: https://aprs.fi/info/a/${process.env.CALLSIGN}`);
                log('===============================================');
                process.exit(0);
            } else {
                const remaining = maxCount - sentCount;
                const nextTime = new Date(Date.now() + interval * 1000).toLocaleTimeString();
                const totalRemaining = Math.round((remaining * interval) / 60);
                log(`⏳ Sonraki gönderim: ${nextTime}`);
                log(`📊 Kalan: ${remaining} adet (~${totalRemaining} dakika)`);
            }
            
        } catch (error) {
            logError('❌ Otomatik gönderim hatası:', error.message);
        }
    }, interval * 1000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        clearInterval(sendInterval);
        const endTime = new Date();
        const totalDuration = Math.round((endTime - startTime) / 1000 / 60);
        
        log('🛑 Sabit İstasyon Gönderimi Durduruldu');
        log('=====================================');
        log(`📊 Gönderilen: ${sentCount}/${maxCount} paket`);
        log(`⏱️  Çalışma Süresi: ${totalDuration} dakika`);
        if (sentCount > 0) {
            log(`📡 Ortalama Aralık: ${Math.round(totalDuration / sentCount)} dakika/paket`);
        }
        log('=====================================');
        process.exit(0);
    });
}

// Modül export'ları
module.exports = {
    APRSPositionSender,
    APRSISClient,
    calculatePasscode
};

// Script doğrudan çalıştırılıyorsa ana fonksiyonu çalıştır
if (require.main === module) {
    main().catch(logError);
}