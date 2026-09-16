import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fiyat Verici",
    short_name: "Fiyat Verici",
    description: "Telefon alış ve satış fiyatlarını piyasa verisiyle hesaplar.",
    start_url: "/al",
    display: "standalone",
    orientation: "portrait",
    background_color: "#e9edf2",
    theme_color: "#13233a",
    lang: "tr",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
