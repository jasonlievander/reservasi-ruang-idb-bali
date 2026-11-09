# Tugas 03: Ruangan, pencarian ketersediaan, blokir slot

## Tujuan
Pengelola mengelola ruangan dan blokir slot; peminjam mencari ruangan yang tersedia.

## Baca dulu
AGENTS.md; docs/PRD.md bagian 7 RU-01 s.d. RU-04; docs/DATA.md BR-01, BR-02; docs/ACCEPTANCE.md AC-RU-01

## Batas perubahan
Endpoint dan logika ruangan, pencarian ketersediaan, dan blokir slot. Tanpa reservasi dan tanpa UI.

## Dependensi
Tugas 01 dan 02.

## Bukti selesai
Test: pencarian hanya mengembalikan ruangan yang kosong pada rentang waktu, memenuhi kapasitas dan jenis; slot yang diblokir tidak muncul sebagai tersedia (AC-RU-01); pengelola hanya dapat mengelola ruangan miliknya; peminjam ditolak mengubah ruangan.
