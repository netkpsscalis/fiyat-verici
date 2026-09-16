import { describe, expect, it } from "vitest";
import { modelNameFromSlug, withSeriesPrefix } from "./getmobil";

const name = (folder: string, slug: string) => withSeriesPrefix(folder, modelNameFromSlug(slug, "xiaomi"));

describe("withSeriesPrefix", () => {
  it("Getmobil'in öneksiz Xiaomi adlarını katalogdaki ada çevirir", () => {
    expect(name("xiaomi", "14t-pro")).toBe("Xiaomi 14T Pro");
    expect(name("poco", "x7-pro")).toBe("POCO X7 Pro");
    expect(name("xiaomi", "c40")).toBe("POCO C40");
    expect(name("xiaomi", "mi-11-t-pro")).toBe("Mi 11T Pro");
    expect(name("redmi", "note-13")).toBe("Redmi Note 13");
    expect(name("xiaomi", "redmi-note-13")).toBe("Redmi Note 13");
  });
});
