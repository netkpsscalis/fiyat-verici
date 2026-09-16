import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { csvToText, pdfToText } from "./files";

describe("csvToText", () => {
  it("noktalı virgüllü Türkçe Excel CSV'sini okur", () => {
    expect(csvToText("﻿Model;Hafıza;Fiyat\niPhone 15 Pro;256;52.500\n")).toBe(
      "Model  Hafıza  Fiyat\niPhone 15 Pro  256  52.500",
    );
  });

  it("tırnak içindeki virgülü ayırıcı saymaz", () => {
    expect(csvToText('"iPhone 15, Pro",256,"52,500"')).toBe("iPhone 15, Pro  256  52,500");
  });
});

describe("pdfToText", () => {
  it("tablo satırlarını soldan sağa, yukarıdan aşağı okur", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 300]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const cell = (s: string, x: number, y: number) => page.drawText(s, { x, y, size: 12, font });
    // Sıra karışık yazılsa da çıktı düzenli olmalı
    cell("54.900", 300, 220);
    cell("iPhone 15 Pro", 20, 250);
    cell("Galaxy S24 Ultra", 20, 220);
    cell("256", 200, 250);
    cell("12/256", 200, 220);
    cell("52.500", 300, 250);

    const text = await pdfToText(Buffer.from(await doc.save()));
    expect(text.split("\n")).toEqual(["iPhone 15 Pro  256  52.500", "Galaxy S24 Ultra  12/256  54.900"]);
  });
});
