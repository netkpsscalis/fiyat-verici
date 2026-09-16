/**
 * Toptancı dosyalarını düz metne çevirir; her tablo satırı bir metin satırı olur.
 * Böylece Excel, CSV ve PDF, WhatsApp metniyle aynı ayrıştırıcıdan geçer.
 */
import readXlsxFile from "read-excel-file/node";
import { getDocumentProxy } from "unpdf";

export class FileReadError extends Error {}

function cellText(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return "";
  return String(c).trim();
}

export async function xlsxToText(buf: Buffer): Promise<string> {
  const lines: string[] = [];
  // Tüm sayfalar okunur: bazı toptancılar markaları ayrı sayfalara koyuyor
  for (const { data } of await readXlsxFile(buf)) {
    for (const r of data) {
      const cells = r.map(cellText).filter(Boolean);
      if (cells.length) lines.push(cells.join("  "));
    }
  }
  return lines.join("\n");
}

/** Tırnakları dikkate alarak tek bir CSV satırını böler. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function csvToText(raw: string): string {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/);
  const sample = lines.slice(0, 20).join("\n");
  // Türkçe Excel CSV'yi ";" ile kaydeder; virgül fiyatların içinde de geçebilir
  const sep = sample.includes(";") ? ";" : sample.includes("\t") ? "\t" : ",";
  return lines
    .map((l) =>
      splitCsvLine(l, sep)
        .map((c) => c.trim())
        .filter(Boolean)
        .join("  "),
    )
    .filter(Boolean)
    .join("\n");
}

/** PDF'teki metin parçalarını dikey konumlarına göre satırlara toplar. */
export async function pdfToText(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      // Aynı satırdaki parçaların y değeri birkaç birim oynayabilir
      const y = Math.round(item.transform[5] / 3);
      const list = rows.get(y) ?? [];
      list.push({ x: item.transform[4], s: item.str.trim() });
      rows.set(y, list);
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      lines.push(
        rows
          .get(y)!
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join("  "),
      );
    }
  }
  return lines.join("\n");
}

export async function fileToText(name: string, buf: Buffer): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx")) return xlsxToText(buf);
  if (lower.endsWith(".pdf")) return pdfToText(buf);
  if (lower.endsWith(".csv")) return csvToText(buf.toString("utf8"));
  if (lower.endsWith(".txt")) return buf.toString("utf8");
  if (lower.endsWith(".xls")) throw new FileReadError("Eski .xls biçimi okunmuyor. Dosyayı Excel'de .xlsx olarak kaydedip tekrar yükle.");
  throw new FileReadError("Bu dosya türü okunmuyor. Excel (.xlsx), CSV, PDF veya metin dosyası yükle.");
}
