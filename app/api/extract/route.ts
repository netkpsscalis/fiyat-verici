import { FileReadError, fileToText } from "@/lib/parsers/files";

export const runtime = "nodejs";
const MAX_BYTES = 8 * 1024 * 1024;

/** Toptancı dosyasını metne çevirir. Ayrıştırma ve önizleme tarayıcıda yapılır. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Dosya seçilmedi." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Dosya 8 MB'tan büyük." }, { status: 413 });

  try {
    const text = await fileToText(file.name, Buffer.from(await file.arrayBuffer()));
    if (!text.trim()) return Response.json({ error: "Dosyada okunabilir metin yok. Taranmış (resim) PDF olabilir." }, { status: 422 });
    return Response.json({ text });
  } catch (e) {
    const message = e instanceof FileReadError ? e.message : "Dosya okunamadı. Bozuk ya da şifreli olabilir.";
    return Response.json({ error: message }, { status: 422 });
  }
}
