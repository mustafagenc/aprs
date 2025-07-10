# 📡 APRS Position Sender

Modern web arayüzlü Node.js APRS-IS konum gönderici uygulaması. **Web tarayıcısı** ve **Electron Desktop** modlarında çalışabilir.

## 🚀 Özellikler

- ✅ **Modern Web Arayüzü** - Socket.IO ile canlı loglar ve kontrol
- ✅ **Electron Desktop App** - Masaüstü uygulaması desteği
- ✅ **Sistem Tepsisi** - Arka planda çalışma
- ✅ **Uzay Temalı Tasarım** - Animasyonlu SVG uydu efektleri
- ✅ **APRS-IS Gerçek Gönderim** - Euro.aprs2.net üzerinden
- ✅ **Otomatik Periyodik Gönderim** - Sabit istasyon optimizasyonu
- ✅ **Demo Mode** - Railway deployment için güvenli test modu
- ✅ **Auto Start on Deploy** - Railway'de otomatik başlatma
- ✅ **PWA Desteği** - Favicon ve web app manifest
- ✅ **Responsive Tasarım** - Mobil ve masaüstü uyumlu
- ✅ **Rate Limiting Koruması** - APRS ağı dostu
- ✅ **Passcode Otomatik Hesaplama**
- ✅ **Tam Ekran Log Görüntüleyici** - ESC ile kapatma

## 🖥️ Desktop Uygulaması (Electron)

### Kurulum
```bash
# Dependencies kur
npm install

# Development modunda çalıştır
npm run electron-dev

# Production modunda çalıştır  
npm run electron

# Platform-specific build
npm run build-win    # Windows
npm run build-mac    # macOS  
npm run build-linux  # Linux
npm run build        # Tüm platformlar
```

### Desktop Özellikleri
- 🖥️ **Native masaüstü uygulaması**
- 🔔 **Sistem tepsisi desteği**
- ⌨️ **Klavye kısayolları** (F11: Tam ekran, F12: DevTools)
- 🚪 **Tek instance** (Aynı anda sadece bir uygulama)
- 📱 **Auto-updater** (gelecek versiyonlarda)
- 💾 **Platform-specific dosya yolları**

<details>
<summary><strong>🚂 Railway Deployment (Tıklayın)</strong></summary>

Bu projeyi Railway üzerinde ücretsiz olarak 7/24 çalıştırabilirsiniz:

### 📱 NPM Run Auto
![NPM Run Auto](resources/railway-screenshot-1.png)

### 📊 Railway Deployment Logları
![Railway Logs](resources/railway-screenshot-2.png)

### 🚀 Hızlı Kurulum
```bash
# 1. Railway CLI kur
npm install -g @railway/cli

# 2. Login ol
railway login

# 3. Proje başlat
railway init

# 4. Environment variables ekle
railway add CALLSIGN=TB2ABI
railway add LATITUDE=41.011805
railway add LONGITUDE=29.125039
railway add APRS_IS_PASSCODE=22440
railway add AUTO_START_ON_DEPLOY=true
railway add AUTO_SEND_ENABLED=true
railway add AUTO_SEND_INTERVAL=600
railway add AUTO_SEND_COUNT=10
railway add DEMO_MODE=false

# 5. Deploy et
railway up
```

### ✅ Railway Avantajları
- **Ücretsiz**: 750 saat/ay + $5 kredi
- **Web Arayüzü**: http://yourapp.railway.app:3000
- **Auto Start**: Deploy sonrası otomatik APRS gönderimi
- **Demo Mode**: Güvenli test ortamı
- **PORT Desteği**: Railway'in dinamik port ataması
- **TCP Socket**: APRS-IS tam destek ✅
- **Always-on**: 7/24 çalışır, uyku modu yok
- **Git entegrasyonu**: Otomatik deployment
- **Environment variables**: Tam destek

### 🔧 Alternatif Deployment Seçenekleri
| Platform | Ücretsiz Plan | TCP Desteği | Always-On | Önerilen |
|----------|---------------|-------------|-----------|----------|
| 🚂 Railway | 750 saat/ay | ✅ | ✅ | ⭐⭐⭐⭐⭐ |
| 🎨 Render | 750 saat/ay | ✅ | ✅ | ⭐⭐⭐⭐ |
| 🟣 Heroku | 1000 saat/ay | ⚠️ | ❌ Sleep | ⭐⭐⭐ |
| 🐋 Fly.io | 3 app limit | ✅ | ✅ | ⭐⭐⭐⭐ |

**5 dakikada Railway'de çalışır durumda!** 🎉

</details>

## 📋 Kurulum

```bash
npm install
```

## ⚙️ Konfigürasyon

`.env` dosyasını düzenleyin:

```properties
# Gerekli ayarlar
CALLSIGN=TB2ABI
LATITUDE=41.011805
LONGITUDE=29.125039
COMMENT=Mustafa Genç\nhttps://mustafagenc.info
SYMBOL=/-

# APRS-IS ayarları
APRS_IS_SERVER=euro.aprs2.net
APRS_IS_PORT=14580
APRS_IS_PASSCODE=112233

# Otomatik gönderim
AUTO_SEND_ENABLED=true
AUTO_SEND_INTERVAL=600
AUTO_SEND_COUNT=10

# Railway/Deploy ayarları
AUTO_START_ON_DEPLOY=true
DEMO_MODE=false
DEMO_MESSAGE=🚨 Bu Railway demo versiyonudur. Gerçek APRS gönderimi sadece yetkili operatörler tarafından yapılabilir.

# Web server
WEB_PORT=3000
```

## 🎯 Kullanım

### 🌐 Web Arayüzü (Ana Özellik)
```bash
npm start
# Tarayıcıda: http://localhost:3000
```

**Web Arayüzü Özellikleri:**
- 🎨 **Uzay Temalı Dark Mode** - Mor degrade + yıldızlar
- 🛰️ **Animasyonlu SVG Uydular** - 6 farklı uydu çeşidi
- 📊 **Canlı Konfigürasyon Kartları** - Tüm ayarlar görünür
- 🔴🟢 **Status Indicator'ları** - Auto/tek gönderim durumu
- 📋 **Real-time Log Viewer** - Scrollable, renkli loglar
- 🎮 **Buton Kontrolleri** - Başlat/Durdur/Temizle
- 📱 **Responsive Design** - Mobil ve masaüstü uyumlu
- 🚫 **Demo Mode Desteği** - Railway için güvenli test

### 💻 Komut Satırı
```bash
# Simülasyon modu
node index.js

# Tek gönderim
npm run send
# veya: node index.js --send

# Durum paketi gönder
npm run status
# veya: node index.js --status

# Otomatik gönderim  
npm run auto
# veya: node index.js --auto

# Web server
npm run web
# veya: node web-server.js
```

### 📢 APRS Durum (Status) Gönderimi

APRS ağında sadece konum değil, istasyonunuzun durumunu da paylaşabilirsiniz:

```bash
# .env dosyasında durum mesajını ayarlayın
APRS_STATUS=QRV 144.800 MHz FM - Online and monitoring

# Durum paketi gönder
npm run status
```

**Status Mesajı Örnekleri:**
- `QRV 144.800 MHz FM - Online and monitoring`
- `Mobile station - En route to contest`
- `Fixed station - Repeater operator`
- `QRT - Going offline for maintenance`
- `Contest station - CQ CQWW SSB`

**Web Arayüzünde Durum Gönderimi:**
- 🟣 **"Durum Gönder" Butonu** - Mor renkli, 📢 ikonu
- ✅ **Demo Mode Desteği** - Güvenli test için simülasyon
- 📋 **Gerçek Zamanlı Log** - Durum paketi detayları görünür

## 📊 Sabit İstasyon - Gönderim Aralıkları

| 🏠 **İstasyon Tipi** | ⏱️ **Aralık** | ✅ **Önerilen** | 📝 **Açıklama** |
|----------------------|----------------|-----------------|------------------|
| 🚨 **Acil Durum**    | 30 saniye      | 1 dakika        | Kritik durumlar  |
| 🏠 **Ev İstasyonu**  | 10 dakika      | 15-30 dakika    | Sabit konum      |
| 📡 **Repeater**      | 30 dakika      | 60 dakika       | Altyapı          |
| 🧪 **Test/Demo**     | 2 dakika       | 5 dakika        | Geliştirme       |

### 🎯 **Sabit İstasyon Optimizasyonları**

- ✅ **Varsayılan aralık**: 10 dakika (600 saniye)
- ✅ **Optimal aralık**: 15-30 dakika
- ✅ **Maksimum gönderim**: 10 paket
- ✅ **Toplam çalışma süresi**: ~100 dakika
- ✅ **Ağ dostu**: Minimal APRS ağı yükü

### ⚠️ Önemli Notlar

- **Minimum aralık**: 60 saniye (güvenlik limiti)
- **Spam koruması**: Aynı paket tekrarlanmaz
- **Rate limiting**: Çok sık gönderim IP ban'e neden olur
- **Ağ yükü**: APRS ağını gereksiz yüklemeyin
- **Demo Mode**: Railway'de güvenli test için `DEMO_MODE=true`
- **Auto Start**: `AUTO_START_ON_DEPLOY=true` ile deploy sonrası otomatik başlatma

## 🎨 Web Arayüzü Özellikleri

### 🌌 Uzay Teması
- **Dark Mode**: Mor degrade arka plan
- **Yıldızlar**: Animasyonlu twinkle efekti
- **SVG Uydular**: 6 farklı uydu çeşidi (communications, GPS, weather, research, space station, deep space)
- **Responsive**: Mobil ve masaüstü uyumlu

### 🎮 İnteraktif Kontroller
- **Otomatik Başlat**: 10 dakika aralıklarla periyodik gönderim
- **Tek Gönderim**: Manuel tek konum gönderimi
- **Durdur**: Otomatik gönderimi durdur
- **Log Temizle**: Ekranı temizle

### 📊 Canlı Bilgiler
- **Konfigürasyon Kartları**: Çağrı işareti, konum, sembol, aralık
- **Status Indicator'ları**: Yeşil/kırmızı LED'ler
- **Real-time Loglar**: Renk kodlu, timestamp'li
- **Versiyon Bilgisi**: Package.json'dan otomatik

## 🔧 Passcode Hesaplama

Uygulama otomatik olarak callsign'ınız için passcode hesaplar:

```bash
node index.js --send
# Çıktıda passcode gösterilir
```

## 📡 APRS Sembolleri

[`aprs-symbols.html`](aprs-symbols.html) dosyasını tarayıcıda açarak mevcut sembolleri görebilirsiniz.

## 🌐 Kontrol

Gönderilen paketleri şu adreslerde kontrol edebilirsiniz:

- [APRS.fi](https://aprs.fi/)
- [APRSDirect](https://www.aprsdirect.com/)
- [FINDU](http://www.findu.com/)

## 📝 Örnek Çıktı

### 🌐 Web Arayüzü Logları
```
[17:30:15] 🔗 Web arayüzü bağlandı
[17:30:15] � Konfigürasyon yüklendi: TB2ABI
[17:30:16] 🤖 Otomatik gönderim arka planda çalışıyor...
[17:30:20] 🔗 APRS-IS sunucusuna bağlanılıyor: euro.aprs2.net:14580
[17:30:21] ✅ APRS-IS sunucusuna bağlandı
[17:30:21] 📤 Login paketi gönderildi: user TB2ABI pass 22440 vers NodeAPRS 1.0
[17:30:21] 📥 Sunucudan gelen: # logresp TB2ABI verified, server T2UK
[17:30:21] ✅ Giriş doğrulandı - gönderim izni var
[17:30:21] 📡 Paket gönderildi: TB2ABI>APRS:=4100.71N/02907.50E-Mustafa Genç\nhttps://mustafagenc.info
[17:30:23] 🔌 APRS-IS bağlantısı kapandı
[17:30:23] ✅ Paket başarıyla APRS ağına gönderildi!
```

### 💻 Terminal Çıktısı
```
�🚀 APRS-IS Gerçek Gönderim Modu

� Gönderilecek Paket Bilgileri:
=====================================
📍 İstasyon: TB2ABI
🌍 Konum: 41.011805°, 29.125039°
💬 Yorum: Mustafa Genç\nhttps://mustafagenc.info
🔣 Sembol: /-
📦 Paket: TB2ABI>APRS:=4100.71N/02907.50E-Mustafa Genç\nhttps://mustafagenc.info
=====================================

🔗 APRS-IS sunucusuna bağlanılıyor: euro.aprs2.net:14580
✅ APRS-IS sunucusuna bağlandı
📤 Login paketi gönderildi: user TB2ABI pass 22440 vers NodeAPRS 1.0
📥 Sunucudan gelen: # logresp TB2ABI verified, server T2UK
✅ Giriş doğrulandı - gönderim izni var
📡 Paket APRS ağına gönderiliyor...
📡 Paket gönderildi: TB2ABI>APRS:=4100.71N/02907.50E-Mustafa Genç\nhttps://mustafagenc.info
🔌 APRS-IS bağlantısı kapatıldı
✅ Paket başarıyla APRS ağına gönderildi!
🌐 https://aprs.fi adresinden kontrol edebilirsiniz.
```

## 🛡️ Güvenlik

- **Passcode Güvenliği**: APRS-IS passcode'larını güvenli tutun
- **Environment Variables**: Hassas bilgileri `.env` dosyasında saklayın
- **Git Ignore**: `.env` dosyasını Git'e eklemeyin (`.gitignore`)
- **Demo Mode**: Production'da `DEMO_MODE=true` ile güvenli test
- **Rate Limiting**: APRS ağı kurallarına uyun (min 60 saniye aralık)
- **IP Ban Koruması**: Çok sık gönderim yapmayın

## 🚀 Deployment Bilgileri

### Railway
- **Port**: `process.env.PORT` otomatik tespit
- **Auto Start**: `AUTO_START_ON_DEPLOY=true` ile otomatik başlatma
- **Demo Mode**: `DEMO_MODE=true` ile güvenli test ortamı
- **Environment Variables**: Railway dashboard'dan ayarlayın

### Render/Heroku
- **TCP Socket**: APRS-IS desteği mevcut
- **Always-On**: Render'da ücretsiz 750 saat/ay
- **Environment Variables**: Platform dashboard'larından ayarlayın

## 📚 Teknik Detaylar

### Kullanılan Teknolojiler
- **Backend**: Node.js + Express.js
- **WebSocket**: Socket.IO (real-time loglar)
- **Frontend**: HTML5 + Tailwind CSS + Vanilla JS
- **Network**: TCP Socket (APRS-IS)
- **Config**: dotenv (environment variables)

### Dosya Yapısı
```
├── index.js          # Ana APRS gönderim scripti
├── web-server.js     # Express + Socket.IO server
├── package.json      # NPM dependencies ve scriptler
├── .env              # Environment variables (local)
├── .env.example      # Örnek config dosyası
├── README.md         # Bu dosya
└── public/           # Web arayüzü static dosyaları
    ├── index.html    # Ana web arayüzü
    ├── favicon/      # PWA ikonları
    └── satellites/   # SVG uydu dosyaları
```

## 📄 Lisans

Licensed under the Apache License 2.0 - see [LICENSE](LICENSE) file.
