const net = require('net');
require('dotenv').config();

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
            console.log(`🔗 APRS-IS sunucusuna bağlanılıyor: ${this.server}:${this.port}`);
            
            this.socket = new net.Socket();
            
            this.socket.connect(this.port, this.server, () => {
                console.log('✅ APRS-IS sunucusuna bağlandı');
                this.connected = true;
                
                // Login paketi gönder
                const loginPacket = `user ${this.callsign} pass ${this.passcode} vers NodeAPRS 1.0\r\n`;
                this.socket.write(loginPacket);
                console.log(`📤 Login paketi gönderildi: ${loginPacket.trim()}`);
            });

            this.socket.on('data', (data) => {
                const message = data.toString().trim();
                console.log(`📥 Sunucudan gelen: ${message}`);
                
                if (message.includes('verified')) {
                    console.log('✅ Giriş doğrulandı - gönderim izni var');
                    resolve(true);
                } else if (message.includes('unverified')) {
                    console.log('⚠️  Giriş doğrulanmadı - sadece dinleme modu');
                    resolve(false);
                }
            });

            this.socket.on('error', (err) => {
                console.error('❌ Bağlantı hatası:', err.message);
                reject(err);
            });

            this.socket.on('close', () => {
                console.log('🔌 APRS-IS bağlantısı kapandı');
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
        console.log(`📡 Paket gönderildi: ${packet}`);
    }

    /**
     * Bağlantıyı kapat
     */
    disconnect() {
        if (this.socket) {
            this.socket.end();
            console.log('🔌 APRS-IS bağlantısı kapatıldı');
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
            console.error('❌ CALLSIGN .env dosyasında bulunamadı!');
            return false;
        }

        if (isNaN(latitude) || isNaN(longitude)) {
            console.error('❌ LATITUDE veya LONGITUDE .env dosyasında hatalı!');
            return false;
        }

        console.log('🚀 APRS-IS Gerçek Gönderim Başlatılıyor...\n');

        const packet = this.createPositionPacket(callsign, latitude, longitude, comment, symbol);
        
        console.log('� Gönderilecek Paket Bilgileri:');
        console.log('=====================================');
        console.log(`📍 İstasyon: ${callsign}`);
        console.log(`🌍 Konum: ${latitude}°, ${longitude}°`);
        console.log(`💬 Yorum: ${comment || 'Yok'}`);
        console.log(`🔣 Sembol: ${symbol}`);
        console.log(`📦 Paket: ${packet}`);
        console.log('=====================================\n');

        // APRS-IS bağlantısı kur
        const client = new APRSISClient(server, port, callsign, passcode);

        try {
            const verified = await client.connect();
            
            if (passcode === '-1') {
                console.log('⚠️  PASSCODE ayarlanmamış (-1)');
                console.log('ℹ️  Sadece dinleme modu - paket gönderilmeyecek');
                console.log('ℹ️  Gerçek gönderim için geçerli passcode gerekli');
                
                // Simülasyon olarak bekle
                await new Promise(resolve => setTimeout(resolve, 2000));
                client.disconnect();
                return false;
            }

            if (!verified) {
                console.log('⚠️  Giriş doğrulanmadı - paket gönderilmeyecek');
                client.disconnect();
                return false;
            }

            // Paketi gönder
            console.log('📡 Paket APRS ağına gönderiliyor...');
            client.sendPacket(packet);
            
            // Biraz bekle sonra bağlantıyı kapat
            await new Promise(resolve => setTimeout(resolve, 2000));
            client.disconnect();
            
            console.log('✅ Paket başarıyla APRS ağına gönderildi!');
            console.log('🌐 https://aprs.fi adresinden kontrol edebilirsiniz.');
            
            return true;

        } catch (error) {
            console.error('❌ APRS-IS gönderim hatası:', error.message);
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
            console.error('❌ CALLSIGN .env dosyasında bulunamadı!');
            return null;
        }

        if (isNaN(latitude) || isNaN(longitude)) {
            console.error('❌ LATITUDE veya LONGITUDE .env dosyasında hatalı!');
            console.log('Örnek: LATITUDE=41.01150, LONGITUDE=29.12550');
            return null;
        }

        const packet = this.createPositionPacket(callsign, latitude, longitude, comment, symbol);
        
        console.log('📡 APRS Pozisyon Paketi Oluşturuldu (Simülasyon)');
        console.log('=====================================');
        console.log(`📍 İstasyon: ${callsign}`);
        console.log(`🌍 Konum: ${latitude}°, ${longitude}°`);
        console.log(`💬 Yorum: ${comment || 'Yok'}`);
        console.log(`🔣 Sembol: ${symbol}`);
        console.log('=====================================');
        console.log(`📦 Paket: ${packet}`);
        console.log('=====================================');
        console.log('ℹ️  Bu simülasyon modu - gerçek gönderim için:');
        console.log('   node index.js --send');
        
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
        console.log('🔄 APRS Otomatik Gönderim Modu\n');
        await startAutoSending();
        return;
    }
    
    if (shouldSend) {
        console.log('🚀 APRS-IS Gerçek Gönderim Modu\n');
    } else {
        console.log('🚀 APRS Pozisyon Gönderici (Simülasyon Modu)\n');
    }
    
    const sender = new APRSPositionSender();
    
    if (shouldSend) {
        // Passcode kontrolü
        const callsign = process.env.CALLSIGN;
        const passcode = process.env.APRS_IS_PASSCODE;
        
        if (callsign && passcode === '-1') {
            const calculatedPasscode = calculatePasscode(callsign);
            console.log(`💡 ${callsign} için hesaplanan passcode: ${calculatedPasscode}`);
            console.log('⚠️  .env dosyasında APRS_IS_PASSCODE=-1 ayarlı');
            console.log('ℹ️  Gerçek gönderim için doğru passcode\'u ayarlayın:\n');
            console.log(`   APRS_IS_PASSCODE=${calculatedPasscode}\n`);
        }
        
        // Gerçek gönderim
        const success = await sender.sendPositionToAPRSIS();
        
        if (success) {
            console.log('\n✨ İşlem başarıyla tamamlandı!');
        } else {
            console.log('\n❌ Gönderim başarısız! Ayarları kontrol edin.');
        }
    } else {
        // Simülasyon modu
        const packet = sender.sendPositionFromEnv();
        
        if (packet) {
            console.log('\n✨ Paket oluşturuldu! (Simülasyon)');
            console.log('📡 Gerçek gönderim için: node index.js --send');
            console.log('🔄 Otomatik gönderim için: node index.js --auto');
        } else {
            console.log('\n❌ Paket oluşturulamadı! .env dosyasını kontrol edin.');
        }
    }
}

// Otomatik gönderim fonksiyonu
async function startAutoSending() {
    const autoEnabled = process.env.AUTO_SEND_ENABLED === 'true';
    const interval = parseInt(process.env.AUTO_SEND_INTERVAL) || 600; // 10 dakika varsayılan (sabit istasyon)
    const maxCount = parseInt(process.env.AUTO_SEND_COUNT) || 10;
    
    if (!autoEnabled) {
        console.log('⚠️  Otomatik gönderim .env dosyasında devre dışı');
        console.log('ℹ️  Etkinleştirmek için: AUTO_SEND_ENABLED=true');
        return;
    }

    // Minimum süre kontrolü
    if (interval < 60) {
        console.log('❌ Minimum gönderim aralığı 60 saniye olmalı!');
        console.log('ℹ️  Güvenlik için bu sınır konulmuştur.');
        return;
    }

    // Sabit istasyon için öneriler
    const stationType = interval >= 600 ? 'Sabit İstasyon' : interval >= 300 ? 'Yarı-Sabit' : 'Mobil/Test';
    const efficiency = interval >= 600 ? '🟢 Optimal' : interval >= 300 ? '🟡 İyi' : '🟠 Sık';

    console.log('📊 Sabit İstasyon - Otomatik Gönderim Ayarları:');
    console.log('===============================================');
    console.log(`🏠 İstasyon Tipi: ${stationType}`);
    console.log(`⏰ Aralık: ${interval} saniye (${Math.round(interval/60)} dakika)`);
    console.log(`📊 Verimlilik: ${efficiency}`);
    console.log(`🔢 Maksimum: ${maxCount} gönderim`);
    console.log(`🌍 Konum: ${process.env.LATITUDE}°, ${process.env.LONGITUDE}°`);
    console.log(`📡 Toplam Süre: ~${Math.round((maxCount * interval) / 60)} dakika`);
    console.log('===============================================\n');

    // Sabit istasyon için uyarılar
    if (interval < 300) {
        console.log('⚠️  DİKKAT: Sabit istasyon için 5 dakikadan kısa aralık önerilmez!');
        console.log('💡 Önerilen aralık: 10-30 dakika (600-1800 saniye)');
        console.log('⚠️  APRS ağını gereksiz yüklemeyin.');
        console.log('⚠️  Devam etmek için 10 saniye bekleniyor...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
    } else if (interval >= 600) {
        console.log('✅ Sabit istasyon için optimal aralık!');
        console.log('💡 APRS ağı dostu gönderim aralığı.');
        console.log('🌐 Ağ yükünü minimize ediyorsunuz.\n');
    }

    const sender = new APRSPositionSender();
    let sentCount = 0;
    let lastPacket = '';
    let startTime = new Date();

    console.log('🚀 Sabit istasyon otomatik gönderimi başlıyor...\n');

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
                console.log(`⏭️  [${sentCount + 1}/${maxCount}] Aynı paket - atlanıyor (${new Date().toLocaleTimeString()})`);
            } else {
                console.log(`📡 [${sentCount + 1}/${maxCount}] Gönderiliyor... (${new Date().toLocaleTimeString()})`);
                
                const success = await sender.sendPositionToAPRSIS();
                
                if (success) {
                    console.log(`✅ [${sentCount + 1}/${maxCount}] Başarıyla gönderildi!\n`);
                    lastPacket = currentPacket;
                } else {
                    console.log(`❌ [${sentCount + 1}/${maxCount}] Gönderim başarısız!\n`);
                }
            }
            
            sentCount++;
            
            // Maksimum sayıya ulaşıldıysa dur
            if (sentCount >= maxCount) {
                clearInterval(sendInterval);
                const endTime = new Date();
                const totalDuration = Math.round((endTime - startTime) / 1000 / 60);
                
                console.log('🏁 Sabit İstasyon Otomatik Gönderim Tamamlandı!');
                console.log('===============================================');
                console.log(`📊 Toplam Gönderim: ${sentCount} paket`);
                console.log(`⏱️  Toplam Süre: ${totalDuration} dakika`);
                console.log(`📡 Ortalama Aralık: ${Math.round(totalDuration / sentCount)} dakika/paket`);
                console.log(`🌐 APRS.fi kontrolü: https://aprs.fi/info/a/${process.env.CALLSIGN}`);
                console.log('===============================================');
                process.exit(0);
            } else {
                const remaining = maxCount - sentCount;
                const nextTime = new Date(Date.now() + interval * 1000).toLocaleTimeString();
                const totalRemaining = Math.round((remaining * interval) / 60);
                console.log(`⏳ Sonraki gönderim: ${nextTime}`);
                console.log(`📊 Kalan: ${remaining} adet (~${totalRemaining} dakika)`);
            }
            
        } catch (error) {
            console.error('❌ Otomatik gönderim hatası:', error.message);
        }
    }, interval * 1000);

    // Graceful shutdown
    process.on('SIGINT', () => {
        clearInterval(sendInterval);
        const endTime = new Date();
        const totalDuration = Math.round((endTime - startTime) / 1000 / 60);
        
        console.log('\n🛑 Sabit İstasyon Gönderimi Durduruldu');
        console.log('=====================================');
        console.log(`📊 Gönderilen: ${sentCount}/${maxCount} paket`);
        console.log(`⏱️  Çalışma Süresi: ${totalDuration} dakika`);
        if (sentCount > 0) {
            console.log(`📡 Ortalama Aralık: ${Math.round(totalDuration / sentCount)} dakika/paket`);
        }
        console.log('=====================================');
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
    main().catch(console.error);
}