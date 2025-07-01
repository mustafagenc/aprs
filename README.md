# 📡 APRS Position Sender

Node.js ile APRS-IS üzerinden konum gönderme uygulaması.

## 🚀 Özellikler

- ✅ APRS pozisyon paketi oluşturma
- ✅ APRS-IS üzerinden gerçek gönderim
- ✅ Otomatik periyodik gönderim
- ✅ Simülasyon modu
- ✅ Passcode otomatik hesaplama
- ✅ Rate limiting koruması

## 📋 Kurulum

```bash
npm install
```

## ⚙️ Konfigürasyon

`.env` dosyasını düzenleyin:

```properties
# Gerekli ayarlar
CALLSIGN=YourCall-1
LATITUDE=41.01150
LONGITUDE=29.12550
COMMENT=Your message
SYMBOL=/-

# APRS-IS ayarları
APRS_IS_PASSCODE=12345

# Otomatik gönderim (opsiyonel)
AUTO_SEND_ENABLED=false
AUTO_SEND_INTERVAL=300
AUTO_SEND_COUNT=5
```

## 🎯 Kullanım

### Simülasyon (Test)
```bash
npm start
# veya
node index.js
```

### Tek Gönderim
```bash
npm run send
# veya
node index.js --send
```

### Otomatik Gönderim
```bash
npm run auto
# veya
node index.js --auto
```

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

## 🔧 Passcode Hesaplama

Uygulama otomatik olarak callsign'ınız için passcode hesaplar:

```bash
node index.js --send
# Çıktıda passcode gösterilir
```

## 📡 APRS Sembolleri

`aprs-symbols.html` dosyasını tarayıcıda açarak mevcut sembolleri görebilirsiniz.

## 🌐 Kontrol

Gönderilen paketleri şu adreslerde kontrol edebilirsiniz:

- [APRS.fi](https://aprs.fi/)
- [APRSDirect](https://www.aprsdirect.com/)
- [FINDU](http://www.findu.com/)

## 📝 Örnek Çıktı

```
🚀 APRS-IS Gerçek Gönderim Modu

📦 Gönderilecek Paket Bilgileri:
=====================================
📍 İstasyon: TB2ABI
🌍 Konum: 41.0115°, 29.1255°
💬 Yorum: https://mustafagenc.info
🔣 Sembol: /-
📦 Paket: TB2ABI>APRS:=4100.69N/02907.53E-https://mustafagenc.info
=====================================

🔗 APRS-IS sunucusuna bağlanılıyor: euro.aprs2.net:14580
✅ APRS-IS sunucusuna bağlandı
📤 Login paketi gönderildi: user TB2ABI pass 22440 vers NodeAPRS 1.0
📥 Sunucudan gelen: # logresp TB2ABI verified, server T2LAUSITZ
✅ Giriş doğrulandı - gönderim izni var
📡 Paket APRS ağına gönderiliyor...
📡 Paket gönderildi: TB2ABI>APRS:=4100.69N/02907.53E-https://mustafagenc.info
🔌 APRS-IS bağlantısı kapatıldı
✅ Paket başarıyla APRS ağına gönderildi!
```

## 🛡️ Güvenlik

- Passcode'ları güvenli tutun
- `.env` dosyasını Git'e eklemeyin
- Rate limiting kurallarına uyun
- Gereksiz gönderim yapmayın

## 📄 Lisans

ISC License
