import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme";
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
  title: "Mandate — Authority without custody",
  description:
    "Mandate gives one named agent a narrow, revocable, expiring onchain right to execute one immutable 1inch Aqua strategy — while treasury custody never leaves the owner wallet.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#101013" },
  ],
};

const themePrepaint = `try{if(localStorage.getItem('mandate-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${onest.variable} ${geistMono.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themePrepaint }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
