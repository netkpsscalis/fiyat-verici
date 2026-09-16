import { formatStorage } from "@/lib/format";
import { parseSize, type ExtractedOffer } from "./jsonld";

/**
 * Takip edilen sayfadaki tekliflerden bu varyantın fiyatını seçer.
 * - Teklifler hafızaya göre ayrılmışsa (Samsung mağazası gibi) sadece aynı hafızalılar alınır.
 * - Sayfa tek bir "başlangıç fiyatı" veriyorsa (Apple mağazası gibi) bu fiyat en düşük hafızaya aittir;
 *   başka hafızaya yazılmaz, hata verilir.
 */
export function pickTrackedPrice(
  offers: ExtractedOffer[],
  variant: { ramGb: number | null; storageGb: number },
  lowestStorageGb: number,
): number {
  const available = offers.filter((o) => o.inStock !== false && (!o.currency || o.currency === "TRY"));
  if (available.length === 0) throw new Error("Sayfada okunabilir fiyat bulunamadı.");

  const withSize = available.map((o) => ({ o, size: parseSize(o.size) ?? parseSize(o.name) }));
  if (withSize.some((x) => x.size)) {
    const match = withSize.filter(
      (x) =>
        x.size &&
        x.size.storageGb === variant.storageGb &&
        (x.size.ramGb === null || variant.ramGb === null || x.size.ramGb === variant.ramGb),
    );
    if (match.length === 0) throw new Error(`Sayfada ${formatStorage(variant.storageGb)} seçeneği bulunamadı.`);
    return Math.min(...match.map((x) => x.o.price));
  }

  if (variant.storageGb !== lowestStorageGb) {
    throw new Error(
      `Sayfa hafızaya göre fiyat vermiyor, sadece başlangıç fiyatı var. Bu linki ${formatStorage(lowestStorageGb)} seçeneğine ekle.`,
    );
  }
  return Math.min(...available.map((o) => o.price));
}
