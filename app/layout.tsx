import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono, Onest } from "next/font/google";
import { Nav } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-archivo" });
const onest = Onest({ subsets: ["latin", "latin-ext"], variable: "--font-onest" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "Fiyat Verici", template: "%s · Fiyat Verici" },
  description: "İkinci el telefon alış fiyatını piyasa verisiyle hesaplar.",
  appleWebApp: { capable: true, title: "Fiyat Verici", statusBarStyle: "default" },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#13233a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${archivo.variable} ${onest.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 lg:px-8 lg:pt-8 lg:pb-16">{children}</main>
        <ServiceWorker />
      </body>
    </html>
  );
}
