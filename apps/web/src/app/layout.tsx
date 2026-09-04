import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const onest = localFont({
  src: [
    { path: "../../public/fonts/onest-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/onest-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/onest-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-onest",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../../public/fonts/geistmono-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/geistmono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mandate: Authority Without Custody",
  description:
    "Mandate gives one named agent a narrow, revocable, expiring onchain right to execute one immutable 1inch Aqua strategy while treasury custody never leaves the owner wallet.",
};

export const viewport: Viewport = {
  themeColor: "#f6f5f0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${onest.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
