# Tugas 06: Pembatalan

## Tujuan
Peminjam membatalkan reservasi sendiri; pengelola membatalkan dengan alasan.

## Baca dulu
AGENTS.md; docs/PRD.md bagian 7 PB-01 s.d. PB-03; docs/DATA.md BR-03, BR-04; docs/ACCEPTANCE.md AC-PB-01 s.d. AC-PB-03

## Batas perubahan
Logika pembatalan, batas waktu pembatalan, pelepasan slot, audit log. Tanpa notifikasi dan UI.

## Dependensi
Tugas 04 dan 05.

## Bukti selesai
Test: akun lain ditolak dan data tidak berubah (AC-PB-01); pembatalan sendiri sebelum batas berhasil dan slot tersedia lagi (AC-PB-02); lewat batas ditolak dengan penjelasan (AC-PB-03); pembatalan pengelola wajib alasan dan tercatat.
