# Tugas 01: Struktur data dan validasi

## Tujuan
Menyediakan skema database dan validasi dasar sesuai model data, tanpa logika reservasi.

## Baca dulu
AGENTS.md; docs/DATA.md (bagian 8 BR-01, BR-05, BR-08; bagian 10 model data)

## Batas perubahan
Skema Prisma, migrasi, modul validasi waktu dan kapasitas, seed data sintetis (beberapa ruangan, pengguna, organisasi). Tidak membuat endpoint atau UI.

## Dependensi
Tidak ada.

## Bukti selesai
Test tipe dan relasi; test validasi: mulai = selesai ditolak, di luar jam operasional ditolak, peserta melebihi kapasitas ditolak, konversi WITA benar di pergantian hari. Seed hanya berisi data sintetis.
