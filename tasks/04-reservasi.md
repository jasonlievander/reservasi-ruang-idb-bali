# Tugas 04: Reservasi tanpa bentrok

## Tujuan
Peminjam mengajukan reservasi; slot dialokasikan eksklusif dan tidak pernah ganda.

## Baca dulu
AGENTS.md; docs/PRD.md bagian 7 RS-01 s.d. RS-07; docs/DATA.md BR-01, BR-02, BR-05, BR-06, BR-07, status reservasi, edge case; docs/ACCEPTANCE.md AC-RS-01 s.d. AC-RS-06

## Batas perubahan
Modul reservasi: pengajuan, cek ulang ketersediaan saat kirim, idempotensi, status awal (Terkonfirmasi atau Menunggu persetujuan sesuai aturan ruangan), daftar reservasi sendiri, riwayat status. Tanpa persetujuan, pembatalan, notifikasi, atau UI.

## Dependensi
Tugas 01 s.d. 03.

## Bukti selesai
Test: sukses (AC-RS-01, AC-RS-02); dua request bersamaan pada satu slot, tepat satu berhasil (AC-RS-03); request berulang tidak menggandakan (AC-RS-04); validasi waktu dan kapasitas (AC-RS-05, AC-RS-06); bentrok dengan blokir ditolak; batas reservasi aktif (BR-07).
