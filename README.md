# Fiyat Verici

Telefoncu için **ikinci el alış fiyatı** uygulaması. Müşterinin getirdiği cihazın durumunu birkaç dokunuşla girersin,
uygulama piyasa verisine göre **En az / Ortalama / En çok** alış teklifini, her teklifte bırakacağın kârı ve fiyatın hangi
kaynaklardan geldiğini gösterir.

Telefona uygulama gibi kurulur (PWA).

## Bölümler

| Sekme | Ne işe yarar |
|---|---|
| **Al** | Marka (Apple / Samsung / Xiaomi / Diğer), model, hafıza, kozmetik, pil sağlığı, parça geçmişi, garanti ve IMEI kaydını seç; alış teklifini gör. İlan fiyatlarını yapıştır, Getmobil fiyatlarını yenile. "Aldım" ile alışı kaydet. |
| **Ayarlar** | Kâr payları, en az kâr, kaynak oranları ve her durum kesintisinin oranı. Geçmiş sayfasına buradan gidilir. |

## Fiyat nasıl hesaplanır?

1. **Satış değeri:** Sahibinden/Dolap/Letgo ilan fiyatı, cihazı dükkanda satabileceğin fiyat sayılır. Son 30 günün fiyatları
   tazeliğe göre ağırlıklandırılır, uç değerler atılır, ortanca alınır. İlan ya da kendi satışın yoksa Getmobil'in
   garantili yenilenmiş fiyatı %82 oranıyla kullanılır.
2. **Durum kesintileri:** Cihazın durumuna göre yüzde ya da TL kesintiler uygulanır (Ayarlar'dan değiştirilebilir).
3. **Teklifler:** Satış değerinden marka grubunun kâr payı düşülür. Android cihazlar ikinci elde daha hızlı değer kaybettiği
   ve ilan fiyatından pazarlıkla satıldığı için ilan fiyatına ayrıca "satış oranı" uygulanır:

   | Grup | Kâr payı (en çok / ortalama / en az) | Satış oranı | 26.000 TL'lik ilana teklif |
   |---|---|---|---|
   | Apple | %10 / %13 / %17 | %100 | 21.500 / 22.500 / 23.250 |
   | Samsung | %13 / %17 / %22 | %94 | 19.000 / 20.250 / 21.250 |
   | Xiaomi / Redmi / POCO | %16 / %21 / %26 | %90 | 17.300 / 18.400 / 19.600 |
   | Diğer Android | %18 / %23 / %30 | %88 | |

   Hepsi Ayarlar'dan değiştirilir. Kendi satış kayıtlarına satış oranı uygulanmaz. Rakip alış teklifi varsa ortalama teklif onunla harmanlanır. Her cihazda en az kâr
   tutarı korunur.
4. **Güven:** Veri azsa ya da eskiyse uygulama uyarır.
5. **Kendi işlemlerinden öğrenme:** Önerilen fiyatlarla senin gerçekten aldığın fiyatlar karşılaştırılır; sürekli yüksek ya da
   düşük öneriyorsa katsayısını kendi düzeltir (en az 3 işlem gerekir).

## Kaynaklar

| Kaynak | Durum |
|---|---|
| Getmobil (yenilenmiş 2. el fiyatlar) | Otomatik, her sabah 07:00. Al ekranındaki "Getmobil fiyatlarını yenile" ile anında. Getmobil'de görülen yeni modeller kataloğa kendiliğinden eklenir. |
| Sahibinden, Dolap, Letgo, Facebook (2. el ilan) | Bot korumalı, otomatik okunamaz. Al ekranındaki "İlan fiyatlarını yapıştır" kutusuna arama sonucunu yapıştır; hasarlı, kilitli, başka model ve başka hafızalı ilanlar ile uç fiyatlar atlanır. |

Kaynaklar **robots.txt kurallarına uyarak** ve kendini açıkça tanıtarak okunur; bot doğrulaması isteyen siteler atlatılmaya
çalışılmaz.

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

Getmobil fiyatlarını elle güncellemek için:

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
