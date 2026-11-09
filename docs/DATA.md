# DATA: Aturan bisnis, status, model data, edge case (SIRU)

> Nomor bagian dipertahankan dari PRD lengkap (v0.1) agar rujukan seperti "bagian 7" tetap valid. Bagian yang tidak ada di file ini ada di file lain di folder docs/. ID (AK-01, BR-02, AC-RS-03, dst.) tidak boleh diubah tanpa memperbarui semua file.

Baca file ini sebelum mengubah apa pun yang menyentuh data, status, atau aturan reservasi.

## 8. Aturan bisnis

| ID | Aturan | Test penting |
|----|--------|--------------|
| BR-01 | Waktu mulai harus sebelum waktu selesai dan berada dalam jam operasional ruangan. | Mulai = selesai ditolak |
| BR-02 | Reservasi aktif (Menunggu persetujuan atau Terkonfirmasi) pada ruangan yang sama tidak boleh beririsan satu sama lain maupun dengan blokir. | Dua request bersamaan: maksimal satu berhasil |
| BR-03 | Peminjam hanya boleh membatalkan reservasi miliknya sendiri dan sebelum batas waktu pembatalan. | Pembatalan oleh akun lain atau lewat batas ditolak |
| BR-04 | Pembatalan dan keputusan persetujuan selalu mencatat pelaku, waktu, dan alasan. | Status berubah dan audit log tersimpan |
| BR-05 | Jumlah peserta tidak boleh melebihi kapasitas ruangan. | Input melebihi kapasitas ditolak |
| BR-06 | Reservasi organisasi dapat diajukan oleh pengguna mana saja; daftar organisasi bersifat acuan, bukan syarat keanggotaan **[keputusan produk]**. | Pengajuan tanpa keanggotaan tetap diterima |
| BR-07 | Batas jumlah reservasi aktif per peminjam dan jarak maksimal pemesanan ke depan ditentukan konfigurasi (usulan awal: 3 reservasi aktif, 30 hari ke depan). | Pengajuan melebihi batas ditolak |
| BR-08 | Zona waktu sistem adalah WITA (UTC+8); semua waktu ditampilkan dan dicek dalam zona ini. | Uji pergantian hari |

## 9. Status reservasi

| Status | Arti | Transisi yang diizinkan |
|--------|------|--------------------------|
| Menunggu persetujuan | Diajukan, slot ditahan | → Terkonfirmasi, Ditolak, Dibatalkan, Kedaluwarsa |
| Terkonfirmasi | Slot dialokasikan pada peminjam | → Dibatalkan, Selesai |
| Ditolak | Pengelola menolak, slot dilepas | akhir |
| Dibatalkan | Dibatalkan peminjam atau pengelola, slot dilepas | akhir |
| Kedaluwarsa | Tidak diputuskan tepat waktu, slot dilepas | akhir |
| Selesai | Waktu pakai telah lewat | akhir |
| Gagal | Alokasi gagal saat pengajuan (bentrok) | akhir; tidak menahan slot |

Setiap perubahan status memiliki kondisi, pelaku, dan hasil yang dapat diuji.

## 10. Model data (logis)

| Entitas | Atribut utama | Aturan |
|---------|---------------|--------|
| Pengguna | id, nama, email kampus, peran, status aktif | Peran: peminjam, pengelola, admin. Email unik. |
| Organisasi | id, nama, pembina | Anggota/pengurus terhubung ke pengguna. |
| Ruangan | id, nama, gedung, lantai, kapasitas, fasilitas, jam buka-tutup, butuh_persetujuan, durasi_maks, aktif | Satu ruangan memiliki satu atau lebih pengelola. |
| Reservasi | id, pengguna_id, ruangan_id, organisasi_id (opsional), mulai, selesai, jenis, nama_kegiatan, jumlah_peserta, status, dibuat_pada, idempotency_key | mulai < selesai; ID sebagai key. |
| Blokir slot | id, ruangan_id, mulai, selesai, alasan, dibuat_oleh | Memengaruhi ketersediaan seperti reservasi aktif. |
| Riwayat status / audit log | id, reservasi_id, status_lama, status_baru, pelaku, waktu, alasan | Tidak dapat diubah setelah dibuat. |
| Notifikasi | id, penerima, jenis, status kirim, waktu | Kegagalan tidak memengaruhi reservasi. |

Relasi: 1 pengguna : banyak reservasi; 1 ruangan : banyak reservasi dan blokir; 1 reservasi : banyak catatan riwayat.

## 11. Kondisi gagal dan edge case

| Kondisi | Perilaku yang diharapkan | Test |
|---------|--------------------------|------|
| Input tidak valid | Tolak, tandai kolom, jelaskan alasan | Waktu terbalik, kapasitas terlampaui |
| Klik kirim dua kali | Tidak membuat reservasi ganda (RS-06) | Ulang request dengan idempotency key sama |
| Jaringan putus saat mengirim | Peminjam dapat memeriksa status di "Reservasi saya" tanpa mengajukan ulang | Putus koneksi lalu cek status |
| Slot berubah saat peminjam memilih | Cek ulang saat konfirmasi; tawarkan alternatif | Dua pengguna memilih slot sama |
| Ruangan dinonaktifkan/diblokir setelah reservasi dibuat | Pengelola membatalkan dengan alasan; peminjam diberi tahu | Blokir yang beririsan dengan reservasi terkonfirmasi |
| Pengelola tidak merespons | Pengajuan kedaluwarsa otomatis (AP-03) | Simulasi lewat batas waktu |
| Pengguna dinonaktifkan | Reservasi mendatang ditinjau pengelola; akses ditolak | Nonaktifkan akun |
| Layanan notifikasi mati | Reservasi tetap berlaku (NT-02) | Matikan mock notifikasi |
