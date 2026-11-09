# Tugas 05: Persetujuan pengelola

## Tujuan
Pengelola menyetujui atau menolak pengajuan; pengajuan tak diputuskan menjadi kedaluwarsa.

## Baca dulu
AGENTS.md; docs/PRD.md bagian 7 AP-01 s.d. AP-04; docs/DATA.md BR-02, BR-04, status reservasi; docs/ACCEPTANCE.md AC-AP-01 s.d. AC-AP-03

## Batas perubahan
Antrean pengajuan, aksi setujui/tolak dengan alasan wajib, pekerjaan kedaluwarsa otomatis, audit log. Tanpa notifikasi dan UI.

## Dependensi
Tugas 04.

## Bukti selesai
Test: setujui mengubah status dan mencatat pelaku (AC-AP-02); tolak tanpa alasan ditolak (AC-AP-01); kedaluwarsa melepas slot (AC-AP-03); transisi status yang tidak diizinkan ditolak; persetujuan memeriksa ulang bentrok (AP-04); pengelola ruangan lain ditolak.
