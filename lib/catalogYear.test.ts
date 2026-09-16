import { describe, expect, it } from "vitest";
import { guessReleaseYear } from "./catalogYear";

describe("guessReleaseYear", () => {
  it("iPhone yıllarını bulur", () => {
    expect(guessReleaseYear("apple", "iPhone 17 Pro Max")).toBe(2025);
    expect(guessReleaseYear("apple", "iPhone 11")).toBe(2019);
    expect(guessReleaseYear("apple", "iPhone XS Max")).toBe(2018);
    expect(guessReleaseYear("apple", "iPhone X")).toBe(2017);
    expect(guessReleaseYear("apple", "iPhone 8 Plus")).toBe(2017);
    expect(guessReleaseYear("apple", "iPhone 6S")).toBe(2015);
    expect(guessReleaseYear("apple", "iPhone SE (2022)")).toBe(2022);
  });

  it("Samsung yıllarını bulur", () => {
    expect(guessReleaseYear("samsung", "Galaxy S24 Ultra")).toBe(2024);
    expect(guessReleaseYear("samsung", "Galaxy S10")).toBe(2019);
    expect(guessReleaseYear("samsung", "Galaxy S9 Plus")).toBe(2018);
    expect(guessReleaseYear("samsung", "Galaxy A55")).toBe(2024);
    expect(guessReleaseYear("samsung", "Galaxy A17")).toBe(2026);
    expect(guessReleaseYear("samsung", "Galaxy Z Fold6")).toBe(2024);
  });

  it("Xiaomi yıllarını bulur", () => {
    expect(guessReleaseYear("xiaomi", "Redmi Note 13 Pro")).toBe(2024);
    expect(guessReleaseYear("xiaomi", "Redmi 9C")).toBe(2020);
    expect(guessReleaseYear("xiaomi", "POCO X6 Pro")).toBe(2024);
    expect(guessReleaseYear("xiaomi", "Xiaomi 14T Pro")).toBe(2024);
  });

  it("bilinmeyen markada tahmin yapmaz", () => {
    expect(guessReleaseYear("oppo", "Reno14")).toBeNull();
  });
});
