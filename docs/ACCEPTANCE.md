# ACCEPTANCE: Acceptance test dan ketertelusuran (SIRU)

> Nomor bagian dipertahankan dari PRD lengkap (v0.1) agar rujukan seperti "bagian 7" tetap valid. Bagian yang tidak ada di file ini ada di file lain di folder docs/. ID (AK-01, BR-02, AC-RS-03, dst.) tidak boleh diubah tanpa memperbarui semua file.

Setiap test otomatis sebaiknya menyebut ID AC yang diujinya (misalnya di nama test). Jangan hapus atau melemahkan test agar lulus.

## 15. Acceptance test (Given–When–Then)

| ID | Given | When | Then |
|----|-------|------|------|
| AC-RS-01 | Slot tersedia, ruangan tanpa persetujuan, akun valid | Peminjam mengonfirmasi pengajuan | Satu reservasi berstatus Terkonfirmasi beserta ID |
| AC-RS-02 | Slot tersedia, ruangan butuh persetujuan | Peminjam mengajukan | Status Menunggu persetujuan; slot tidak dapat diajukan pihak lain |
| AC-RS-03 | Slot tersedia, dua akun valid | Dua request dikirim bersamaan | Tepat satu berhasil, lainnya ditolak karena konflik |
| AC-RS-04 | Pengajuan sudah berhasil | Request yang sama diulang | Tidak ada reservasi ganda |
| AC-RS-05 | Waktu mulai ≥ waktu selesai | Peminjam mengirim | Ditolak dengan pesan pada kolom terkait |
| AC-RS-06 | Jumlah peserta melebihi kapasitas | Peminjam mengirim | Ditolak dengan alasan kapasitas |
| AC-AP-01 | Pengajuan Menunggu persetujuan | Pengelola menolak tanpa alasan | Ditolak oleh sistem; alasan wajib |
| AC-AP-02 | Pengajuan Menunggu persetujuan | Pengelola menyetujui | Status Terkonfirmasi; peminjam diberi tahu |
| AC-AP-03 | Pengajuan belum diputuskan melewati batas waktu | Waktu berjalan | Status Kedaluwarsa; slot tersedia kembali |
| AC-PB-01 | Reservasi milik mahasiswa A | Mahasiswa B mencoba membatalkan | Akses ditolak; data tidak berubah |
| AC-PB-02 | Reservasi milik sendiri, sebelum batas pembatalan | Peminjam membatalkan | Status Dibatalkan; slot tersedia; riwayat tercatat |
| AC-PB-03 | Reservasi milik sendiri, lewat batas pembatalan | Peminjam membatalkan | Ditolak dengan penjelasan |
| AC-RU-01 | Pengelola memblokir slot | Peminjam mencari pada rentang itu | Slot tidak muncul sebagai tersedia |
| AC-AK-01 | Pengguna belum login | Mengakses endpoint reservasi | Ditolak (401/403) |
| AC-NT-01 | Layanan notifikasi gagal | Pengajuan disetujui | Reservasi tetap Terkonfirmasi |

## 16. Ketertelusuran (traceability)

| Tujuan | Requirement | Testing | Metrik |
|--------|-------------|---------|--------|
| Reservasi mudah | RU-02, RS-01 s.d. RS-05 | Usability test; AC-RS-01/02 | Tingkat selesai tanpa bantuan |
| Status jelas | RS-05, RS-07, AP-02, NT-01 | Uji pemahaman status | Kesalahan memahami status |
| Tanpa bentrok | BR-02, RS-04, AP-04 | AC-RS-03, concurrency test | Jumlah bentrok = 0 |
| Pengelola terbantu | AP-01, RU-04, AD-02 | Simulasi pengelola | Waktu keputusan; rekap tersedia |
| Aman dan terkendali | AK-02, SEC-01, BR-03, NF-05 | AC-PB-01, AC-AK-01 | Test negatif lulus |
