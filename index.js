const net = require('net');
require('dotenv').config();

// Global error handlers
process.on('uncaughtException', (error) => {
	console.error('❌ Uncaught Exception:', error);
	process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
	process.exit(1);
});

// Log wrapper - sadece console'a yaz (web-server.js zaten stdout'u yakalıyor)
function log(message) {
	console.log(message);
	return; // Explicitly return void to prevent undefined
}

function logError(message) {
	console.error(message);
	return; // Explicitly return void to prevent undefined
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
			log(
				`🔗 APRS-IS sunucusuna bağlanılıyor: ${this.server}:${this.port}`
			);

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
	 * @param {string} path - APRS path (opsiyonel)
	 * @returns {string} - APRS paketi
	 */
	createPositionPacket(callsign, lat, lng, comment = '', symbol = '/>', path = 'APRS') {
		// Enlem ve boylamı APRS formatına çevir
		const latDeg = Math.floor(Math.abs(lat));
		const latMin = (Math.abs(lat) - latDeg) * 60;
		const latDir = lat >= 0 ? 'N' : 'S';

		const lngDeg = Math.floor(Math.abs(lng));
		const lngMin = (Math.abs(lng) - lngDeg) * 60;
		const lngDir = lng >= 0 ? 'E' : 'W';

		const latStr = `${latDeg.toString().padStart(2, '0')}${latMin
			.toFixed(2)
			.padStart(5, '0')}${latDir}`;
		const lngStr = `${lngDeg.toString().padStart(3, '0')}${lngMin
			.toFixed(2)
			.padStart(5, '0')}${lngDir}`;

		// APRS pozisyon paketi formatı
		const packet = `${callsign}>${path}:=${latStr}${symbol[0]}${lngStr}${symbol[1]}${comment}`;

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
		const path = process.env.APRS_PATH || 'APRS';
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

		const packet = this.createPositionPacket(
			callsign,
			latitude,
			longitude,
			comment,
			symbol,
			path
		);

		log('\n📋 Gönderilecek Paket Bilgileri:\n');
		log('=====================================\n');
		log(`📍 İstasyon: ${callsign}\n`);
		log(`🌍 Konum: ${latitude}°, ${longitude}°\n`);
		log(`💬 Yorum: ${comment || 'Yok'}\n`);
		log(`🔣 Sembol: ${symbol}\n`);
		log(`�️  Path: ${path}\n`);
		log(`�📦 Paket: ${packet}\n`);
		log('=====================================\n');

		// APRS-IS bağlantısı kur
		const client = new APRSISClient(server, port, callsign, passcode);

		try {
			const verified = await client.connect();

			if (passcode === '-1') {
				log('⚠️  PASSCODE ayarlanmamış (-1)');
				log('ℹ️  Sadece dinleme modu - paket gönderilmeyecek');
				log('ℹ️  Gerçek gönderim için geçerli passcode gerekli');

				// Simülasyon olarak bekle
				await new Promise((resolve) => setTimeout(resolve, 2000));
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
			await new Promise((resolve) => setTimeout(resolve, 2000));
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
		const path = process.env.APRS_PATH || 'APRS';

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

		const packet = this.createPositionPacket(
			callsign,
			latitude,
			longitude,
			comment,
			symbol,
			path
		);

		log('📡 APRS Pozisyon Paketi Oluşturuldu (Simülasyon)');
		log('=====================================');
		log(`📍 İstasyon: ${callsign}`);
		log(`🌍 Konum: ${latitude}°, ${longitude}°`);
		log(`💬 Yorum: ${comment || 'Yok'}`);
		log(`🔣 Sembol: ${symbol}`);
		log(`🛤️  Path: ${path}`);
		log('=====================================');
		log(`📦 Paket: ${packet}`);
		log('=====================================');
		log('ℹ️  Bu simülasyon modu - gerçek gönderim için:');
		log('   node index.js --send');

		return packet;
	}

	/**
	 * APRS durum paketi oluştur
	 * @param {string} callsign - Çağrı işareti
	 * @param {string} status - Durum mesajı
	 * @param {string} path - APRS path (opsiyonel)
	 * @returns {string} - APRS status paketi
	 */
	createStatusPacket(callsign, status, path = 'APRS') {
		// APRS status paketi formatı: CALLSIGN>PATH:>STATUS_MESSAGE
		const packet = `${callsign}>${path}:>${status}`;
		return packet;
	}

	/**
	 * Durum gönderimi (.env dosyasından bilgileri alarak) - Gerçek gönderim
	 */
	async sendStatusToAPRSIS() {
		const callsign = process.env.CALLSIGN;
		const status = process.env.APRS_STATUS || '';
		const path = process.env.APRS_PATH || 'APRS';
		const server = process.env.APRS_IS_SERVER || 'euro.aprs2.net';
		const port = parseInt(process.env.APRS_IS_PORT) || 14580;
		const passcode = process.env.APRS_IS_PASSCODE || '-1';

		// Gerekli bilgileri kontrol et
		if (!callsign) {
			logError('❌ CALLSIGN .env dosyasında bulunamadı!');
			return false;
		}

		if (!status) {
			logError('❌ APRS_STATUS .env dosyasında bulunamadı!');
			logError(
				'ℹ️  Örnek: APRS_STATUS=QRV 144.800 MHz FM - Online and monitoring'
			);
			return false;
		}

		log('🚀 APRS-IS Durum Gönderimi Başlatılıyor...');

		const packet = this.createStatusPacket(callsign, status, path);

		log('📋 Gönderilecek Durum Paketi Bilgileri:');
		log('=====================================');
		log(`📍 İstasyon: ${callsign}`);
		log(`📢 Durum: ${status}`);
		log(`🛤️  Path: ${path}`);
		log(`📦 Paket: ${packet}`);
		log('=====================================');

		// APRS-IS bağlantısı kur
		const client = new APRSISClient(server, port, callsign, passcode);

		try {
			const verified = await client.connect();

			if (passcode === '-1') {
				log('⚠️  PASSCODE ayarlanmamış (-1)');
				log('ℹ️  Sadece dinleme modu - durum paketi gönderilmeyecek');
				log('ℹ️  Gerçek gönderim için geçerli passcode gerekli');

				// Simülasyon olarak bekle
				await new Promise((resolve) => setTimeout(resolve, 2000));
				client.disconnect();
				return false;
			}

			if (!verified) {
				log('⚠️  Giriş doğrulanmadı - durum paketi gönderilmeyecek');
				client.disconnect();
				return false;
			}

			// Paketi gönder
			log('📡 Durum paketi APRS ağına gönderiliyor...');
			client.sendPacket(packet);

			// Biraz bekle sonra bağlantıyı kapat
			await new Promise((resolve) => setTimeout(resolve, 2000));
			client.disconnect();

			log('✅ Durum paketi başarıyla APRS ağına gönderildi!');
			log('🌐 https://aprs.fi adresinden kontrol edebilirsiniz.');

			return true;
		} catch (error) {
			logError('❌ APRS-IS durum gönderim hatası:', error.message);
			client.disconnect();
			return false;
		}
	}

	/**
	 * Durum gönderimi (.env dosyasından bilgileri alarak) - Simülasyon
	 */
	sendStatusFromEnv() {
		const callsign = process.env.CALLSIGN;
		const status = process.env.APRS_STATUS || '';
		const path = process.env.APRS_PATH || 'APRS';

		// Gerekli bilgileri kontrol et
		if (!callsign) {
			logError('❌ CALLSIGN .env dosyasında bulunamadı!');
			return null;
		}

		if (!status) {
			logError('❌ APRS_STATUS .env dosyasında bulunamadı!');
			logError(
				'ℹ️  Örnek: APRS_STATUS=QRV 144.800 MHz FM - Online and monitoring'
			);
			return null;
		}

		const packet = this.createStatusPacket(callsign, status, path);

		log('📢 APRS Durum Paketi Oluşturuldu (Simülasyon)');
		log('=====================================');
		log(`📍 İstasyon: ${callsign}`);
		log(`📢 Durum: ${status}`);
		log(`🛤️  Path: ${path}`);
		log('=====================================');
		log(`📍 İstasyon: ${callsign}`);
		log(`📢 Durum: ${status}`);
		log('=====================================');
		log(`📦 Paket: ${packet}`);
		log('=====================================');
		log('ℹ️  Bu simülasyon modu - gerçek gönderim için:');
		log('   node index.js --status');

		return packet;
	}

	/**
	 * Sistem durum bilgisi oluştur (otomatik)
	 * @returns {string} - Sistem durumu
	 */
	generateSystemStatus() {
		const now = new Date();
		const uptime = process.uptime();
		const uptimeHours = Math.floor(uptime / 3600);
		const uptimeMinutes = Math.floor((uptime % 3600) / 60);

		// Sistem bilgileri
		const memUsage = process.memoryUsage();
		const memUsedMB = Math.round(memUsage.rss / 1024 / 1024);

		// Node.js versiyon
		const nodeVersion = process.version;

		// Durum mesajı oluştur
		const status = `QRV Node${nodeVersion} UP:${uptimeHours}h${uptimeMinutes}m RAM:${memUsedMB}MB`;

		return status;
	}

	/**
	 * Durum gönderimi (.env dosyasından bilgileri alarak)
	 * @param {string} customStatus - Özel durum mesajı (opsiyonel)
	 * @param {boolean} includeSystemInfo - Sistem bilgisi dahil et
	 */
	async sendStatusToAPRSIS(customStatus = null, includeSystemInfo = true) {
		const callsign = process.env.CALLSIGN;
		const path = process.env.APRS_PATH || 'APRS';
		const server = process.env.APRS_IS_SERVER || 'euro.aprs2.net';
		const port = parseInt(process.env.APRS_IS_PORT) || 14580;
		const passcode = process.env.APRS_IS_PASSCODE || '-1';

		// Gerekli bilgileri kontrol et
		if (!callsign) {
			logError('❌ CALLSIGN .env dosyasında bulunamadı!');
			return false;
		}

		log('📢 APRS Durum Bilgisi Gönderimi Başlatılıyor...');

		// Durum mesajını hazırla
		let statusMessage;
		if (customStatus) {
			statusMessage = customStatus;
			if (includeSystemInfo) {
				const systemStatus = this.generateSystemStatus();
				statusMessage += ` | ${systemStatus}`;
			}
		} else {
			// .env'den özel durum al
			const envStatus = process.env.APRS_STATUS || 'QRV on 145.500 MHz';
			statusMessage = envStatus;
			if (includeSystemInfo) {
				const systemStatus = this.generateSystemStatus();
				statusMessage += ` | ${systemStatus}`;
			}
		}

		// Zaman damgası oluştur (DHMz formatında)
		const now = new Date();
		const day = now.getUTCDate().toString().padStart(2, '0');
		const hour = now.getUTCHours().toString().padStart(2, '0');
		const minute = now.getUTCMinutes().toString().padStart(2, '0');
		const timestamp = `${day}${hour}${minute}z`;

		const packet = this.createStatusPacket(callsign, statusMessage, path);

		log('📢 Gönderilecek Durum Bilgisi:');
		log('=====================================');
		log(`📍 İstasyon: ${callsign}`);
		log(`📢 Durum: ${statusMessage}`);
		log(`🛤️  Path: ${path}`);
		log(`⏰ Zaman: ${timestamp} UTC`);
		log(`📦 Paket: ${packet}`);
		log('=====================================');

		// APRS-IS bağlantısı kur
		const client = new APRSISClient(server, port, callsign, passcode);

		try {
			const verified = await client.connect();

			if (passcode === '-1') {
				log('⚠️  PASSCODE ayarlanmamış (-1)');
				log('ℹ️  Sadece dinleme modu - paket gönderilmeyecek');
				return false;
			}

			if (!verified) {
				log('⚠️  Giriş doğrulanmadı - paket gönderilmeyecek');
				client.disconnect();
				return false;
			}

			// Paketi gönder
			log('📢 Durum bilgisi APRS ağına gönderiliyor...');
			client.sendPacket(packet);

			// Biraz bekle sonra bağlantıyı kapat
			await new Promise((resolve) => setTimeout(resolve, 2000));
			client.disconnect();

			log('✅ Durum bilgisi başarıyla APRS ağına gönderildi!');
			log('🌐 https://aprs.fi adresinden kontrol edebilirsiniz.');

			return true;
		} catch (error) {
			logError('❌ APRS durum gönderim hatası:', error.message);
			client.disconnect();
			return false;
		}
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

// CLI kullanım talimatları
function showHelp() {
	console.log(`
🌟 APRS-IS Konum ve Durum Gönderici v${require('./package.json').version}
==================================================================

Kullanım:
  node index.js [seçenekler]

Seçenekler:
  --help          Bu yardım mesajını göster
  --send          Gerçek gönderim yap (simülasyon değil)
  --auto          Otomatik periyodik gönderim
  --status        Durum paketi gönder (APRS_STATUS)
  
Ortam Değişkenleri (.env dosyası):
  CALLSIGN=         Çağrı işareti (zorunlu)
  APRS_IS_PASSCODE= APRS-IS passcode (zorunlu, gerçek gönderim için)
  LATITUDE=         Enlem
  LONGITUDE=        Boylam
  APRS_STATUS=      Durum mesajı
  
Örnekler:
  node index.js                    # Konum simülasyonu
  node index.js --send             # Gerçek konum gönderimi
  node index.js --auto             # Otomatik periyodik gönderim
  node index.js --status           # Durum paketi simülasyonu
  node index.js --status --send    # Gerçek durum gönderimi
  
NPM Scripts:
  npm run send                     # Gerçek konum gönder
  npm run auto                     # Otomatik gönderim
  npm run status                   # Durum paketi gönder
  npm run web                      # Web arayüzü başlat
`);
}

// CLI parametrelerini işle
const args = process.argv.slice(2);
const isHelp = args.includes('--help');

if (isHelp) {
	showHelp();
	process.exit(0);
}

// Ana fonksiyon
async function main() {
	const args = process.argv.slice(2);
	const shouldSend = args.includes('--send');
	const autoMode = args.includes('--auto');
	const isStatus = args.includes('--status');

	if (autoMode) {
		log('🔄 APRS Otomatik Gönderim Modu');
		await startAutoSending();
		return;
	}

	if (isStatus) {
		log('📢 APRS Durum Paketi Gönderimi');

		const sender = new APRSPositionSender();

		if (shouldSend) {
			// Gerçek durum gönderimi
			const success = await sender.sendStatusToAPRSIS();

			if (success) {
				log('✨ Durum paketi başarıyla gönderildi!');
			} else {
				log('❌ Durum gönderimi başarısız! Ayarları kontrol edin.');
			}
		} else {
			// Simülasyon modu
			const packet = sender.sendStatusFromEnv();

			if (packet) {
				log('✨ Durum paketi oluşturuldu! (Simülasyon)');
				log('📡 Gerçek gönderim için: node index.js --status --send');
			} else {
				log(
					'❌ Durum paketi oluşturulamadı! .env dosyasını kontrol edin.'
				);
			}
		}
		return;
	}

	if (shouldSend) {
		log('🚀 APRS-IS Gerçek Konum Gönderim Modu');
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
			log(
				`💡 ${callsign} için hesaplanan passcode: ${calculatedPasscode}`
			);
			log('⚠️  .env dosyasında APRS_IS_PASSCODE=-1 ayarlı');
			log("ℹ️  Gerçek gönderim için doğru passcode'u ayarlayın:");
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
			log('📢 Durum gönderimi için: node index.js --status');
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
	const stationType =
		interval >= 600
			? 'Sabit İstasyon'
			: interval >= 300
			? 'Yarı-Sabit'
			: 'Mobil/Test';
	const efficiency =
		interval >= 600 ? '🟢 Optimal' : interval >= 300 ? '🟡 İyi' : '🟠 Sık';

	log('📊 Sabit İstasyon - Otomatik Gönderim Ayarları:');
	log('===============================================');
	log(`🏠 İstasyon Tipi: ${stationType}`);
	log(`⏰ Aralık: ${interval} saniye (${Math.round(interval / 60)} dakika)`);
	log(`📊 Verimlilik: ${efficiency}`);
	log(`🔢 Maksimum: ${maxCount} gönderim`);
	log(`🌍 Konum: ${process.env.LATITUDE}°, ${process.env.LONGITUDE}°`);
	log(`📡 Toplam Süre: ~${Math.round((maxCount * interval) / 60)} dakika`);
	log('===============================================');

	// Sabit istasyon için uyarılar
	if (interval < 300) {
		log(
			'⚠️  DİKKAT: Sabit istasyon için 5 dakikadan kısa aralık önerilmez!'
		);
		log('💡 Önerilen aralık: 10-30 dakika (600-1800 saniye)');
		log('⚠️  APRS ağını gereksiz yüklemeyin.');
		log('⚠️  Devam etmek için 10 saniye bekleniyor...');
		await new Promise((resolve) => setTimeout(resolve, 10000));
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
			const path = process.env.APRS_PATH || 'APRS';

			const currentPacket = sender.createPositionPacket(
				callsign,
				latitude,
				longitude,
				comment,
				symbol,
				path
			);

			// Aynı paket tekrarını önle
			if (currentPacket === lastPacket) {
				log(
					`⏭️  [${
						sentCount + 1
					}/${maxCount}] Aynı paket - atlanıyor (${new Date().toLocaleTimeString()})`
				);
			} else {
				log(
					`📡 [${
						sentCount + 1
					}/${maxCount}] Gönderiliyor... (${new Date().toLocaleTimeString()})`
				);

				const success = await sender.sendPositionToAPRSIS();

				if (success) {
					log(
						`✅ [${
							sentCount + 1
						}/${maxCount}] Başarıyla gönderildi!`
					);
					lastPacket = currentPacket;
				} else {
					log(
						`❌ [${sentCount + 1}/${maxCount}] Gönderim başarısız!`
					);
				}
			}

			sentCount++;

			// Maksimum sayıya ulaşıldıysa dur
			if (sentCount >= maxCount) {
				clearInterval(sendInterval);
				const endTime = new Date();
				const totalDuration = Math.round(
					(endTime - startTime) / 1000 / 60
				);

				log('🏁 Sabit İstasyon Otomatik Gönderim Tamamlandı!');
				log('===============================================');
				log(`📊 Toplam Gönderim: ${sentCount} paket`);
				log(`⏱️  Toplam Süre: ${totalDuration} dakika`);
				log(
					`📡 Ortalama Aralık: ${Math.round(
						totalDuration / sentCount
					)} dakika/paket`
				);
				log(
					`🌐 APRS.fi kontrolü: https://aprs.fi/info/a/${process.env.CALLSIGN}`
				);
				log('===============================================');
				process.exit(0);
			} else {
				const remaining = maxCount - sentCount;
				const nextTime = new Date(
					Date.now() + interval * 1000
				).toLocaleTimeString();
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
			log(
				`📡 Ortalama Aralık: ${Math.round(
					totalDuration / sentCount
				)} dakika/paket`
			);
		}
		log('=====================================');
		process.exit(0);
	});
}

// Modül export'ları
module.exports = {
	APRSPositionSender,
	APRSISClient,
	calculatePasscode,
};

// Script doğrudan çalıştırılıyorsa ana fonksiyonu çalıştır
if (require.main === module) {
	main().catch(logError);
}
