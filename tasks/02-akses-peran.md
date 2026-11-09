# Tugas 02: Akses dan peran

## Tujuan
Login, sesi, dan pemeriksaan peran di server (peminjam, pengelola, admin).

## Baca dulu
AGENTS.md; docs/PRD.md bagian 4 (peran) dan bagian 7 AK-01 s.d. AK-04; bagian 12 SEC-01 s.d. SEC-03; docs/ACCEPTANCE.md AC-AK-01

## Batas perubahan
Modul autentikasi, sesi, middleware peran, pembatasan percobaan login. Gunakan akun lokal dengan password ter-hash; sediakan titik integrasi SSO tanpa mengimplementasikannya (SSO belum diputuskan, lihat PRD bagian 17 no. 3).

## Dependensi
Tugas 01.

## Bukti selesai
Test: anonim ditolak pada endpoint reservasi (AC-AK-01); peran yang salah ditolak; logout mencabut sesi; login gagal berulang dibatasi; password tidak pernah muncul di log atau respons.
