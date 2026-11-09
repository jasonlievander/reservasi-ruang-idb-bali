import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIRU — Sistem Reservasi Ruangan IDB Bali",
  description:
    "Sistem Reservasi Ruangan (SIRU) IDB Bali: cari ruangan kosong, ajukan reservasi, dan kelola persetujuan.",
  icons: {
    icon: [{ url: "/brand/idb.png", type: "image/png" }],
    shortcut: ["/brand/idb.png"],
    apple: [{ url: "/brand/apple-touch-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
