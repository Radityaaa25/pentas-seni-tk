import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pentas Seni TK Aisyiyah 21 Rawamangun 2026",
  description: "Aplikasi Pendaftaran & E-Ticket Pentas Seni",
  // Menambahkan konfigurasi icon menggunakan TKSD.png
  icons: {
    icon: '/TKSD.png',
    shortcut: '/TKSD.png',
    apple: '/TKSD.png',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}