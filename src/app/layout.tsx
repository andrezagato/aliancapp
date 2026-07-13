import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Servir — escalas da sua igreja",
  description:
    "Organize as equipes da sua igreja: escale voluntários, confirme presença e cuide de cada ministério com carinho.",
  applicationName: "Servir",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Servir",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#C4633E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
