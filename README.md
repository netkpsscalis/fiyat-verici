# Fiyat Verici

Telefoncu için fiyatlama uygulaması. Müşterinin getirdiği cihazın durumunu birkaç dokunuşla girersin, uygulama piyasa
verisine göre **En az / Ortalama / En çok** alış teklifini ve bu fiyatın hangi kaynaklardan geldiğini gösterir. Sıfır cihaz
satarken toptancı maliyetine ve piyasa fiyatına göre satış fiyatı önerir.

Telefona uygulama gibi kurulur (PWA).

## Bölümler

| Sekme | Ne işe yarar |
|---|---|
| **Al** | Model, hafıza, kozmetik, pil sağlığı, parça geçmişi, garanti ve IMEI kaydını seç; alış teklifini gör. "Aldım" ile alışı kaydet. |
| **Sat** | Sıfır cihazın toptan maliyeti ve piyasa fiyatına göre satış fiyatı. "Sattım" ile satışı kaydet. |
| **Toptancı** | WhatsApp listesini yapıştır, Excel/CSV/PDF yükle ya da resim olarak gelen listeyi (İdeal Pasaj gibi) okut. Satırları kontrol et, onayladıkların kaydedilir. Tanınmayan yazımları (ör. "15PM") bir kez düzeltirsen uygulama öğrenir. |
| **Piyasa** | Sahibinden ilanı, rakip alış teklifi gibi fiyatları elle ekle. Tüm fiyat kayıtlarını gör. |
| **Ayarlar** | Kâr payları, en az kâr, ilan pazarlık payı ve her durum kesintisinin oranı. Geçmiş ve Kaynaklar sayfalarına buradan gidilir. |

## Fiyat nasıl hesaplanır?

1. **Piyasa değeri:** Son 30 günün 2. el fiyatları (kendi satışların, ilanlar, yenilenmiş cihaz fiyatları) tazeliğe göre
   ağırlıklandırılır, uç değerler atılır, ortanca alınır. İlan fiyatlarından pazarlık payı düşülür.
2. **Durum kesintileri:** Cihazın durumuna göre yüzde ya da TL kesintiler uygulanır (Ayarlar'dan değiştirilebilir).
3. **Teklifler:** Tahmini satış fiyatından kâr payları düşülür. Rakip alış teklifi varsa ortalama teklif onunla harmanlanır.
   Her cihazda en az kâr tutarı korunur.
4. **Güven:** Veri azsa ya da eskiyse uygulama uyarır.

## Otomatik kaynaklar

Kaynaklar günde bir kez, **robots.txt kurallarına uyarak** ve kendini açıkça tanıtarak okunur. Bot doğrulaması isteyen
siteler atlatılmaya çalışılmaz.

| Kaynak | Durum |
|---|---|
| Getmobil (yenilenmiş satış fiyatları) | Otomatik, katalogdaki modellerin çoğu |
| Vatan Bilgisayar (sıfır fiyat) | Otomatik, Apple / Samsung / Xiaomi kategori sayfaları |
| apple.com/tr, samsung.com/tr (resmi sıfır fiyat) | Kaynaklar sayfasından ürün linki eklenerek |
| Epey, Akakçe, Cimri, Hepsiburada, Trendyol, n11, Media Markt, PTT AVM, Teknosa, Sahibinden | Bot korumalı, otomatik okunamaz. Sat ekranındaki "Gördüğün bir fiyatı ekle" kutusundan elle gir |
| Toptancılar | Toptancı sekmesinden liste yükleyerek (metin, Excel, CSV, PDF ya da resim) |

Sat ekranında cihazın satıcı fiyatları en ucuzdan pahalıya sıralanır; otomatik gelen ve elle eklenen fiyatlar aynı listede
görünür. "Kaynakları güncelle" düğmesi o cihazın otomatik kaynaklarını anında okur.

## Bilgisayarda çalıştırma

Gerekenler: Node.js 24.

```bash
npm install
cp .env.example .env.local
npm run db:setup
npm run dev
```

Tarayıcıda http://localhost:3000 adresini aç. Aynı Wi-Fi'daki telefondan bilgisayarın yerel IP adresiyle de açılır
(ör. http://192.168.1.21:3000).

Kaynakları elle güncellemek için:

```bash
npm run sources
```

Testler:

```bash
npm test
```

## Yayına alma (her yerden erişim, telefona kurulum)

Üç ücretsiz hesap gerekir: **GitHub**, **Turso** (veritabanı) ve **Vercel** (uygulama).

1. **Kodu GitHub'a yükle.** Yeni bir özel (private) depo aç ve bu klasörü oraya gönder.
2. **Turso veritabanı oluştur.** turso.tech'te bir veritabanı aç. Veritabanı adresini (`libsql://...turso.io`) ve bir
   erişim anahtarını (token) al. Bilgisayarda `.env.local` dosyasında `DATABASE_URL` ve `DATABASE_AUTH_TOKEN` alanlarını
   bunlarla doldurup tabloları ve kataloğu oluştur:
   ```bash
   npm run db:setup
   ```
3. **Vercel'e bağla.** vercel.com'da GitHub deposunu içe aktar. Ortam değişkenleri (Environment Variables):
   - `DATABASE_URL`, `DATABASE_AUTH_TOKEN`: Turso'dan aldıkların
   - `APP_PASSWORD`: uygulamaya giriş şifren
   - `AUTH_SECRET`: uzun, rastgele bir metin (en az 32 karakter)
4. **Günlük güncellemeyi aç.** GitHub deposunda Settings › Secrets and variables › Actions bölümüne `DATABASE_URL` ve
   `DATABASE_AUTH_TOKEN` ekle. `.github/workflows/sources.yml` her sabah 07:00'de çalışır; Actions sekmesinden elle de
   başlatılabilir.
5. **Telefona kur.** Vercel'in verdiği adresi telefonda aç, şifreyle gir.
   - iPhone (Safari): Paylaş › Ana Ekrana Ekle
   - Android (Chrome): menü › Uygulamayı yükle
