# DESIGN: Design brief dan token (SIRU)

> Status: TERISI. Dipakai untuk UI tugas 09–11. Jangan menambah gaya di luar token ini
> tanpa memperbarui dokumen dan review manusia.

## 1. Design brief

**Purpose:** Memesan ruangan kampus dan memproses persetujuan tanpa bolak-balik ke petugas.
**Audience:** Mahasiswa/pengurus organisasi di ponsel, pengelola sarpras di desktop, admin di desktop.
**Tone:** Bali Design Bureau — editorial kampus, tegas, hangat, terasa seperti signage dan katalog pameran kampus desain.
**Reference:** Situs IDB Bali: oranye #F17711, biru #024D71, Montserrat tebal, foto kampus; digabung dengan bahasa wayfinding dan tiket acara.
**Palette:** Kertas hangat sebagai base, putih untuk permukaan, biru sebagai struktur dan aksi utama, oranye sebagai penanda dan momen.
**Type:** Montserrat untuk display dan teks; IBM Plex Mono untuk label, waktu, dan metadata teknis.
**Memorable:** Rail ketersediaan dan tiket reservasi bertepi perforasi, dengan nomor dan status yang terbaca seperti boarding pass.
**Restraint:** Tanpa gradien ungu, glassmorphism, emoji, ikon berlebihan, atau kartu bulat seragam. Satu radius, satu aksen, banyak ruang dan aturan tipografi.

## 2. Token

```css
:root {
  /* TYPE */
  --font-display: "Montserrat", "Segoe UI", sans-serif;
  --font-text: "Montserrat", "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", "Consolas", monospace;
  --step--1: 0.8rem;
  --step-0: 1rem;
  --step-1: 1.25rem;
  --step-2: 1.563rem;
  --step-3: 1.953rem;
  --step-4: 2.441rem;
  --step-5: 3.052rem;
  --step-6: 3.815rem;

  /* SPACE */
  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-s: 1rem;
  --space-m: 1.5rem;
  --space-l: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4.5rem;
  --space-3xl: 7rem;

  /* COLOR */
  --base: #f6f1e7;
  --surface: #ffffff;
  --surface-2: #fbf7ee;
  --ink: #14262d;
  --ink-2: #465a60;
  --ink-3: #5c6e73;
  --line: #ded7c8;
  --brand: #024d71;
  --brand-2: #0a6a8c;
  --accent: #f17711;
  --accent-text: #a84b08;
  --accent-ink: #2a1604;
  --ok: #256b46;
  --warn: #8a5200;
  --danger: #a32b2b;
  --focus: #0a6a8c;

  /* FORM */
  --radius: 6px;
  --border: 1px solid var(--line);
  --shadow-near: 0 1px 2px rgba(20, 38, 45, 0.06);
  --shadow-far: 0 18px 44px rgba(20, 38, 45, 0.08);

  /* MOTION */
  --dur-fast: 120ms;
  --dur: 220ms;
  --dur-slow: 420ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Kontras terverifikasi: ink/base 13.87:1, ink-2/base 6.45:1, ink-3/base 4.74:1,
brand/base 8.10:1, accent-text/base 5.08:1, putih/brand 9.12:1,
ink/accent 5.49:1. Oranye terang tidak dipakai untuk teks kecil di atas putih.

## 3. Tipografi

- Display: Montserrat 700/800, tracking -0.03em, ukuran `--step-4` sampai `--step-6`.
- Body: Montserrat 400/500, ukuran `--step-0`, line-height 1.55.
- Label: IBM Plex Mono 500, uppercase, tracking 0.08em, ukuran `--step--1`.
- Angka besar: Montserrat 800 dengan tabular numbers.
- Maksimal tiga bobot per layar.

## 4. Spacing, radius, elevasi

- Skala spacing 4px; jarak antar kelompok minimal `--space-m`, dalam kelompok `--space-2xs` sampai `--space-xs`.
- Radius tunggal 6px untuk kartu, tombol, input, badge.
- Shadow hanya untuk elemen mengambang: modal dan toast memakai near + far; kartu memakai border, bukan shadow.

## 5. Komponen inti

- **Kartu ruangan:** label jenis mono, nama display, kapasitas/jam, badge persetujuan, fasilitas, tombol pilih.
- **Rail ketersediaan:** deretan slot waktu dengan garis oranye; slot terpakai ditandai teks, bukan hanya warna.
- **Form pengajuan:** panel/tiket dengan field besar, error di bawah field, idempotency key per percobaan.
- **Badge status:** teks persis dari DESIGN + titik penanda; tidak hanya warna.
- **Tiket reservasi:** header biru, nomor ID mono, perforasi dashed, status besar.
- **Antrean persetujuan:** kartu dengan rail oranye, waktu mono, aksi setujui/tolak.
- **Rekap:** kartu angka besar, bar status, tombol CSV.
- **Dialog:** fokus masuk, Escape menutup, fokus kembali ke pemicu.
- **Toast:** pengumuman `aria-live`, hilang otomatis, tidak menutupi kontrol utama.
- **Empty/error/loading:** pesan singkat + tindakan; skeleton dengan `prefers-reduced-motion`.

## 6. Navigasi

- Peminjam: Ringkasan, Cari ruangan, Reservasi saya.
- Pengelola: Ringkasan, Persetujuan, Ruangan, Rekap.
- Admin: Ringkasan, Persetujuan, Akun.
- Desktop: header sticky dengan logo, nav horizontal, chip pengguna.
- Ponsel: header ringkas + nav horizontal yang dapat di-scroll, target sentuh 44px, tanpa scroll horizontal halaman.

## 7. Interaksi dan animasi

- Hover hanya untuk pointer; pressed memakai translate 1px; focus-visible selalu terlihat.
- Modal/sheet masuk dengan fade + translate 8px, `--dur` dan `--ease-out`.
- Hasil pencarian muncul dengan stagger 40ms, maksimal 6 item.
- Angka statistik tidak menghitung animasi; lebih penting kejelasan.
- `prefers-reduced-motion: reduce` mematikan transform/animasi.
