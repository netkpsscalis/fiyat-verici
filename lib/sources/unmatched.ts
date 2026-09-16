/**
 * Kaynaklarda görülüp katalogda olmayan telefonlar. Ürün adından kataloğa uygun
 * model adı önerilir; kullanıcı onaylayınca katalog genişler.
 */
export interface UnmatchedProduct {
  name: string;
  price: number | null;
  brandId: string | null;
  ramGb: number | null;
  storageGb: number | null;
}

const STOP_WORDS = new Set([
  "akıllı",
  "akilli",
  "telefon",
  "telefonu",
  "cep",
  "5g",
  "4g",
  "dual",
  "sim",
  "yenilenmiş",
  "yenilenmis",
]);

const COLORS = [
  "siyah","beyaz","mavi","yeşil","yesil","kırmızı","kirmizi","pembe","mor","gri","gümüş","gumus","altın","altin","sarı","sari",
  "turuncu","lacivert","titanyum","krem","bej","antrasit","lavanta","buz","açık","acik","koyu","gece","deniz","ada","opal","sis",
  "palmiye","kozmik","laciverttaş","laciverttas","naturel","natural","ultramarine","phantom","graphite","midnight","starlight",
];

/** "Samsung Galaxy A27 5G 8/256 GB Akıllı Telefon Siyah" → "Galaxy A27" */
export function suggestModelName(rawName: string, brandId: string | null): string {
  const words = rawName.replace(/\(.*?\)/g, " ").split(/\s+/).filter(Boolean);
  const STORAGE_NUMBERS = new Set([32, 64, 128, 256, 512, 1024]);
  const out: string[] = [];
  for (const [i, word] of words.entries()) {
    const w = word.toLocaleLowerCase("tr");
    const next = (words[i + 1] ?? "").toLocaleLowerCase("tr");
    // "8/256", "256GB", "GB", "256" ya da "1 TB" gibi hafıza yazımında model adı biter
    const bareNumber = /^\d{1,4}$/.test(w) && (STORAGE_NUMBERS.has(Number(w)) || next === "gb" || next === "tb");
    const isStorage = /^\d{1,2}[/+]\d{2,4}(gb)?$/.test(w) || /^\d{2,4}(gb|tb)$/.test(w) || /^(gb|tb)$/.test(w) || bareNumber;
    if (isStorage || STOP_WORDS.has(w) || COLORS.includes(w)) break;
    out.push(word);
  }
  // Marka adı model adının başında tekrar etmesin: "Xiaomi Redmi 15C" → "Redmi 15C"
  while (out.length > 1) {
    const first = out[0].toLocaleLowerCase("tr");
    const second = out[1].toLocaleLowerCase("tr");
    const dropApple = brandId === "apple" && first === "apple";
    const dropSamsung = brandId === "samsung" && first === "samsung" && second !== "";
    const dropXiaomi = brandId === "xiaomi" && first === "xiaomi" && ["redmi", "poco"].includes(second);
    if (dropApple || dropSamsung || dropXiaomi) out.shift();
    else break;
  }
  return out.join(" ").replace(/[-–,]+$/, "").trim();
}
