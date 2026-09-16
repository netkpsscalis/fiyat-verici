/**
 * Model adından çıkış yılını tahmin eder. Otomatik eklenen modellerde yıl bilinmediği için
 * listede sıralama ve fiyat motorundaki yaşa göre değer kaybı buna dayanır.
 */
export function guessReleaseYear(brandId: string, name: string): number | null {
  const n = name.toLocaleLowerCase("tr");
  // Adında yıl yazıyorsa ("Galaxy A7 2017", "Redmi 10 2022") o geçerli
  const explicit = /\b(20[12]\d)\b/.exec(n);
  if (explicit && brandId !== "apple") return Number(explicit[1]);

  if (brandId === "apple") {
    if (/se \(?2020/.test(n)) return 2020;
    if (/se \(?2022/.test(n)) return 2022;
    if (/iphone air/.test(n)) return 2025;
    if (/iphone xs|iphone xr/.test(n)) return 2018;
    if (/iphone x\b/.test(n)) return 2017;
    const m = /iphone (\d{1,2})/.exec(n);
    if (m) {
      const g = Number(m[1]);
      if (g >= 11) return 2008 + g;
      return { 5: 2013, 6: /6s/.test(n) ? 2015 : 2014, 7: 2016, 8: 2017 }[g] ?? null;
    }
    return null;
  }

  if (brandId === "samsung") {
    let m = /galaxy s(\d{1,2})\b/.exec(n);
    if (m) {
      const g = Number(m[1]);
      return g >= 20 ? 2000 + g : g === 10 ? 2019 : g >= 6 ? 2009 + g : null;
    }
    m = /galaxy z (?:fold|flip)\s?(\d)/.exec(n);
    if (m) return 2018 + Number(m[1]);
    m = /galaxy note\s?(\d{1,2})/.exec(n);
    if (m) return Number(m[1]) >= 20 ? 2000 + Number(m[1]) : 2009 + Number(m[1]);
    // A ve M serisi: son rakam yılı gösterir (A55 → 2024, A17 → 2026, A05 → 2024)
    m = /galaxy [am](\d)(\d)[a-z]?\b/.exec(n);
    if (m) return 2019 + Number(m[2]);
    if (/galaxy a6 plus/.test(n)) return 2018;
    if (/galaxy j7 prime 2/.test(n)) return 2018;
    if (/galaxy j7 pro/.test(n)) return 2017;
    if (/galaxy j7 prime/.test(n)) return 2016;
    if (/galaxy j5/.test(n)) return 2015;
    m = /xcover\s?(\d)/.exec(n);
    if (m) return 2017 + Number(m[1]);
    return null;
  }

  if (brandId === "xiaomi") {
    let m = /redmi note (\d{1,2})/.exec(n);
    if (m) return 2011 + Number(m[1]);
    m = /redmi (\d{1,2})/.exec(n);
    if (m) return 2011 + Number(m[1]);
    m = /poco [xfm](\d)/.exec(n);
    if (m) return 2018 + Number(m[1]);
    m = /poco c(\d)(\d)/.exec(n);
    if (m) return 2018 + Number(m[1]);
    // Xiaomi 16 atlandı: 15 → 2025, 17 → 2026
    m = /xiaomi (\d{2})/.exec(n);
    if (m) return Number(m[1]) >= 17 ? 2009 + Number(m[1]) : 2010 + Number(m[1]);
    m = /\bmi note (\d{2})/.exec(n);
    if (m) return 2009 + Number(m[1]);
    m = /\bmi (\d{2})/.exec(n);
    if (m) return 2010 + Number(m[1]);
    if (/\bmi a2/.test(n)) return 2018;
    return null;
  }

  return null;
}
