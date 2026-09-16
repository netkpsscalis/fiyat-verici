/**
 * Cihaz durum soruları ve her cevabın fiyata etkisi.
 * pct: yüzde kesinti (negatif değer = değer artışı, ör. kalan garanti).
 * fixed: TL cinsinden sabit kesinti.
 * Buradaki değerler başlangıç varsayılanlarıdır; Ayarlar'dan değiştirilebilir.
 */
export type Family = "iphone" | "android";

export interface Adjustment {
  mode: "pct" | "fixed";
  value: number;
}

export interface FactorOption {
  id: string;
  label: string;
  adj: Adjustment;
  /** Bu seçenek seçilirse cihaz alınmaz (hesap kilidi vb.) */
  blocking?: boolean;
}

export interface Factor {
  id: string;
  label: string;
  group: GroupId;
  families: Family[];
  /** Birden fazla seçenek işaretlenebilir (arızalar gibi); hiçbiri seçili değilse sorun yok demektir */
  multi?: boolean;
  /** Tekli sorularda baştan seçili gelen cevap. Yoksa soru "cevaplanmadı" sayılır. */
  defaultOption?: string;
  /** Aile bazında etiket farkı: iPhone'da "Face ID", Android'de "Parmak izi" gibi */
  labelFor?: Partial<Record<Family, string>>;
  help?: string;
  options: FactorOption[];
}

export type GroupId = "kozmetik" | "pil" | "parca" | "fonksiyon" | "belge" | "engel";

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: "kozmetik", label: "Kozmetik ve ekran" },
  { id: "pil", label: "Pil" },
  { id: "parca", label: "Parça ve servis geçmişi" },
  { id: "fonksiyon", label: "Çalışmayan fonksiyonlar" },
  { id: "belge", label: "Garanti, kutu, kayıt" },
  { id: "engel", label: "Engel durumları" },
];

const pct = (value: number): Adjustment => ({ mode: "pct", value });

export const FACTORS: Factor[] = [
  {
    id: "kozmetik",
    label: "Kozmetik",
    group: "kozmetik",
    families: ["iphone", "android"],
    defaultOption: "aplus",
    help: "Kasa ve arka yüzeydeki çizik, ezik ve boya durumu.",
    options: [
      { id: "aplus", label: "A+ Kusursuz", adj: pct(0) },
      { id: "a", label: "A Çok iyi", adj: pct(3) },
      { id: "b", label: "B İyi", adj: pct(8) },
      { id: "c", label: "C Orta", adj: pct(15) },
      { id: "d", label: "D Yıpranmış", adj: pct(25) },
    ],
  },
  {
    id: "ekran",
    label: "Ekran",
    group: "kozmetik",
    families: ["iphone", "android"],
    defaultOption: "sorunsuz",
    options: [
      { id: "sorunsuz", label: "Sorunsuz", adj: pct(0) },
      { id: "cizik", label: "Çizik var", adj: pct(5) },
      { id: "yanik", label: "Yanık / gölge", adj: pct(20) },
      { id: "kirik", label: "Kırık / çatlak", adj: pct(25) },
      { id: "dokunmatik", label: "Dokunmatik sorunlu", adj: pct(30) },
    ],
  },
  {
    id: "pil_sagligi",
    label: "Pil sağlığı",
    group: "pil",
    families: ["iphone"],
    help: "Ayarlar › Pil › Pil Sağlığı ve Şarj. Referans fiyat %90-94 aralığına göredir.",
    options: [
      { id: "p95", label: "%95-100", adj: pct(-2) },
      { id: "p90", label: "%90-94", adj: pct(0) },
      { id: "p85", label: "%85-89", adj: pct(4) },
      { id: "p80", label: "%80-84", adj: pct(8) },
      { id: "p79", label: "%80 altı", adj: pct(13) },
    ],
  },
  {
    id: "pil_durumu",
    label: "Pil durumu",
    group: "pil",
    families: ["android"],
    defaultOption: "bilinmiyor",
    help: "Samsung Members veya servis menüsünden bakılabiliyorsa işaretle.",
    options: [
      { id: "bilinmiyor", label: "Bakılmadı", adj: pct(0) },
      { id: "iyi", label: "İyi", adj: pct(0) },
      { id: "orta", label: "Orta", adj: pct(4) },
      { id: "zayif", label: "Zayıf", adj: pct(10) },
      { id: "sismis", label: "Şişmiş", adj: pct(15) },
    ],
  },
  {
    id: "parca_ekran",
    label: "Ekran parçası",
    group: "parca",
    families: ["iphone"],
    defaultOption: "degismemis",
    help: "Ayarlar › Genel › Hakkında › Parça ve Servis Geçmişi.",
    options: [
      { id: "degismemis", label: "Değişmemiş", adj: pct(0) },
      { id: "orijinal", label: "Orijinal Apple parçası", adj: pct(6) },
      { id: "kullanilmis", label: "Kullanılmış parça", adj: pct(10) },
      { id: "bilinmeyen", label: "Bilinmeyen parça", adj: pct(20) },
    ],
  },
  {
    id: "parca_pil",
    label: "Pil parçası",
    group: "parca",
    families: ["iphone"],
    defaultOption: "degismemis",
    options: [
      { id: "degismemis", label: "Değişmemiş", adj: pct(0) },
      { id: "orijinal", label: "Orijinal Apple parçası", adj: pct(2) },
      { id: "kullanilmis", label: "Kullanılmış parça", adj: pct(5) },
      { id: "bilinmeyen", label: "Bilinmeyen parça", adj: pct(8) },
    ],
  },
  {
    id: "parca_kamera",
    label: "Kamera parçası",
    group: "parca",
    families: ["iphone"],
    defaultOption: "degismemis",
    options: [
      { id: "degismemis", label: "Değişmemiş", adj: pct(0) },
      { id: "orijinal", label: "Orijinal Apple parçası", adj: pct(4) },
      { id: "kullanilmis", label: "Kullanılmış parça", adj: pct(7) },
      { id: "bilinmeyen", label: "Bilinmeyen parça", adj: pct(12) },
    ],
  },
  {
    id: "ekran_degisim",
    label: "Ekran değişimi",
    group: "parca",
    families: ["android"],
    defaultOption: "degismemis",
    options: [
      { id: "degismemis", label: "Değişmemiş", adj: pct(0) },
      { id: "servis", label: "Servis orijinali", adj: pct(6) },
      { id: "muadil", label: "Muadil / yan sanayi", adj: pct(20) },
    ],
  },
  {
    id: "kasa",
    label: "Kasa ve arka cam",
    group: "parca",
    families: ["iphone", "android"],
    defaultOption: "orijinal",
    options: [
      { id: "orijinal", label: "Orijinal", adj: pct(0) },
      { id: "arka_cam", label: "Arka cam değişmiş", adj: pct(5) },
      { id: "kasa", label: "Kasa değişmiş", adj: pct(8) },
    ],
  },
  {
    id: "anakart",
    label: "Anakart",
    group: "parca",
    families: ["iphone", "android"],
    defaultOption: "islemsiz",
    options: [
      { id: "islemsiz", label: "İşlem görmemiş", adj: pct(0) },
      { id: "islemli", label: "İşlem görmüş", adj: pct(20) },
    ],
  },
  {
    id: "biyometrik",
    label: "Face ID / Touch ID",
    labelFor: { android: "Parmak izi / yüz tanıma" },
    group: "fonksiyon",
    families: ["iphone", "android"],
    defaultOption: "calisiyor",
    options: [
      { id: "calisiyor", label: "Çalışıyor", adj: pct(0) },
      { id: "calismiyor", label: "Çalışmıyor", adj: pct(25) },
    ],
  },
  {
    id: "true_tone",
    label: "True Tone",
    group: "fonksiyon",
    families: ["iphone"],
    defaultOption: "var",
    options: [
      { id: "var", label: "Var", adj: pct(0) },
      { id: "yok", label: "Yok", adj: pct(5) },
    ],
  },
  {
    id: "arizalar",
    label: "Arızalı parçalar",
    group: "fonksiyon",
    families: ["iphone", "android"],
    multi: true,
    help: "Sadece çalışmayanları işaretle.",
    options: [
      { id: "kamera", label: "Arka kamera", adj: pct(12) },
      { id: "on_kamera", label: "Ön kamera", adj: pct(6) },
      { id: "hoparlor", label: "Hoparlör", adj: pct(5) },
      { id: "ahize", label: "Ahize", adj: pct(4) },
      { id: "mikrofon", label: "Mikrofon", adj: pct(5) },
      { id: "sarj", label: "Şarj soketi", adj: pct(6) },
      { id: "titresim", label: "Titreşim", adj: pct(2) },
      { id: "sensor", label: "Yakınlık sensörü", adj: pct(5) },
      { id: "tuslar", label: "Tuşlar", adj: pct(3) },
      { id: "wifi", label: "Wi-Fi / Bluetooth", adj: pct(10) },
      { id: "sebeke", label: "Şebeke / sinyal", adj: pct(20) },
    ],
  },
  {
    id: "garanti",
    label: "Garanti",
    group: "belge",
    families: ["iphone", "android"],
    defaultOption: "yok",
    options: [
      { id: "yok", label: "Yok", adj: pct(0) },
      { id: "ithalatci", label: "İthalatçı", adj: pct(-1) },
      { id: "resmi_6", label: "Resmi · 6 aydan az", adj: pct(-2) },
      { id: "resmi_12", label: "Resmi · 6-12 ay", adj: pct(-4) },
      { id: "resmi_24", label: "Resmi · 12 aydan fazla", adj: pct(-7) },
    ],
  },
  {
    id: "kutu",
    label: "Kutu ve fatura",
    group: "belge",
    families: ["iphone", "android"],
    defaultOption: "tam",
    options: [
      { id: "tam", label: "Kutu + fatura", adj: pct(0) },
      { id: "kutu", label: "Sadece kutu", adj: pct(3) },
      { id: "yok", label: "Kutu yok", adj: pct(7) },
    ],
  },
  {
    id: "kayit",
    label: "IMEI kaydı",
    group: "belge",
    families: ["iphone", "android"],
    defaultOption: "tr",
    help: "*#06# ile IMEI'yi alıp e-Devlet IMEI sorgusundan kontrol et.",
    options: [
      { id: "tr", label: "TR kayıtlı", adj: pct(0) },
      { id: "pasaport", label: "Yurt dışı / pasaport", adj: pct(20) },
      { id: "kayitsiz", label: "Kayıtsız", adj: pct(45) },
    ],
  },
  {
    id: "engel",
    label: "Engel durumları",
    group: "engel",
    families: ["iphone", "android"],
    multi: true,
    help: "Bunlardan biri varsa cihaz alınmaz.",
    options: [
      { id: "hesap", label: "iCloud / hesap kilidi açık değil", adj: pct(0), blocking: true },
      { id: "karaliste", label: "IMEI kara listede / çalıntı kaydı", adj: pct(0), blocking: true },
    ],
  },
];

export type Selection = Record<string, string | string[] | undefined>;

export function factorsFor(family: Family): Factor[] {
  return FACTORS.filter((f) => f.families.includes(family));
}

export function factorLabel(f: Factor, family: Family): string {
  return f.labelFor?.[family] ?? f.label;
}

export function defaultSelection(family: Family): Selection {
  const sel: Selection = {};
  for (const f of factorsFor(family)) {
    if (f.multi) sel[f.id] = [];
    else if (f.defaultOption) sel[f.id] = f.defaultOption;
  }
  return sel;
}

/** Kullanıcının Ayarlar'da değiştirdiği kesintiler: "factorId:optionId" → Adjustment */
export type Overrides = Record<string, Adjustment>;

export function overrideKey(factorId: string, optionId: string) {
  return `${factorId}:${optionId}`;
}

export function adjustmentFor(factorId: string, option: FactorOption, overrides: Overrides): Adjustment {
  return overrides[overrideKey(factorId, option.id)] ?? option.adj;
}
