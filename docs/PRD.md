# PRD SIRU: Sistem Reservasi Ruangan Kampus

**Institut Desain dan Bisnis Bali** | PRD 0.1 (draft untuk review) | 19 Oktober 2026

Pemilik produk: [diisi: nama PM / unit pengelola sarana prasarana]. Nama produk "SIRU" (Sistem Reservasi Ruangan) ditetapkan sebagai nama resmi.

> **Cara membaca.** Dokumen ini mengikuti struktur Cagan (product purpose, features, release criteria, schedule) dan gaya PRD contoh yang diunggah. Angka target adalah usulan sampai riset awal dilakukan. Hal yang belum diketahui ditulis sebagai **[Asumsi]** atau masuk daftar pertanyaan terbuka di bagian 17. Tidak ada data kampus yang dikarang di sini.

> Nomor bagian dipertahankan dari PRD lengkap (v0.1) agar rujukan seperti "bagian 7" tetap valid. Bagian yang tidak ada di file ini ada di file lain di folder docs/. ID (AK-01, BR-02, AC-RS-03, dst.) tidak boleh diubah tanpa memperbarui semua file.

File ini memuat bagian 1–7, 12–14, 17–19. Aturan bisnis, status, model data, dan edge case ada di `DATA.md` (bagian 8–11). Acceptance test dan ketertelusuran ada di `ACCEPTANCE.md` (bagian 15–16).

## 1. Produk, masalah, dan tujuan

### Masalah
Sivitas akademika (mahasiswa, pengurus organisasi, dosen, staf) perlu meminjam ruangan untuk kegiatan organisasi, rapat, kerja kelompok, atau keperluan pribadi. **[Asumsi]** Saat ini proses peminjaman dilakukan lewat surat, pesan chat, atau datang langsung ke petugas, sehingga:

- peminjam sulit mengetahui ruangan mana yang kosong pada waktu tertentu;
- status permintaan tidak jelas dan konfirmasi terlambat;
- jadwal bisa bentrok karena data tersebar;
- pengelola kesulitan merekap penggunaan ruangan dan menangani kasus khusus.

Asumsi ini harus diverifikasi lewat wawancara (bagian 3) sebelum PRD dikunci.

### Value proposition
"SIRU membantu sivitas akademika IDB Bali menemukan ruangan yang tersedia dan memastikan peminjamannya berhasil, tanpa bolak-balik ke petugas."

### Tujuan rilis 1.0 (berurutan menurut prioritas)

| # | Tujuan | Baseline | Target usulan | Cara mengukur |
|---|--------|----------|---------------|---------------|
| 1 | Peminjam dapat menyelesaikan reservasi sendiri | Belum diukur | ≥ 85% peserta uji selesai tanpa bantuan | Usability test dengan target pengguna |
| 2 | Status permintaan jelas dan cepat | Belum diukur | Median waktu keputusan ≤ 1 hari kerja; peminjam selalu melihat status terkini | Selisih waktu ajukan dan keputusan; uji pemahaman status |
| 3 | Tidak ada jadwal bentrok | Belum diukur | 0 bentrok pada uji concurrency | Uji dua request bersamaan pada satu slot |
| 4 | Pengelola punya rekap penggunaan | Belum ada | Rekap per ruangan dan periode dapat diekspor | Simulasi pengelola |

**Guardrail:** satu ruangan tidak boleh dipakai dua reservasi aktif pada waktu yang beririsan.

## 2. Prinsip produk

| Prinsip | Konsekuensi |
|---------|-------------|
| Status harus sesuai kenyataan | Konfirmasi hanya muncul setelah slot benar-benar dialokasikan; kegagalan dijelaskan alasannya. |
| Meminjam harus singkat | Alur pengajuan maksimal 4 langkah; fitur tambahan ditunda. |
| Aturan ruangan ditulis di sistem, bukan di kepala petugas | Setiap ruangan punya aturan (jam, kapasitas, perlu persetujuan atau tidak) yang tampil sebelum mengajukan. |
| Data pribadi seperlunya | Pengelola hanya melihat data yang diperlukan untuk memutuskan; kredensial tidak disimpan di aplikasi. |

## 3. Riset awal dan asumsi yang harus diuji

| Sumber | Pertanyaan | Bukti yang dicari |
|--------|-----------|-------------------|
| Mahasiswa dan pengurus organisasi (UKM/BEM/himpunan) | Bagaimana meminjam ruangan sekarang? Apa yang paling menyulitkan? | Wawancara 5–10 orang, contoh kejadian bentrok atau ditolak |
| Dosen dan staf | Kebutuhan ruangan untuk rapat, kelas pengganti, kegiatan | Wawancara dan contoh kasus |
| Pengelola sarpras / BAAK | Aturan peminjaman, siapa yang menyetujui, cara mencatat jadwal sekarang | Dokumen aturan, contoh formulir/surat, jadwal yang dipakai |
| IT kampus | Apakah ada SSO / data akun kampus? Hosting? | Kelayakan integrasi |
| Alternatif | Spreadsheet, grup chat, formulir | Alasan pengguna masih memakainya |

**Asumsi berisiko tinggi:**

| Asumsi | Risiko bila salah | Cara menguji |
|--------|-------------------|--------------|
| Jadwal kuliah tersedia dan dapat diblokir di sistem | Reservasi bentrok dengan kelas | Audit sumber data jadwal; impor atau input manual |
| Pengelola sanggup memproses persetujuan cepat | Target waktu keputusan gagal | Simulasi beban kerja pengelola |
| Mahasiswa memahami status "Menunggu persetujuan" | Mengira reservasi sudah pasti | Uji pemahaman status pada prototype |
| Semua peminjaman organisasi perlu persetujuan | Proses terlalu lambat | Review aturan kampus; bedakan per jenis ruangan |

## 4. Pengguna dan peran

### Persona

**Rani, pengurus UKM (pengguna utama).** Mengatur rapat dan kegiatan organisasi tiap minggu. Tujuan: memastikan ruangan benar-benar tersedia. Konteks: memakai ponsel, waktu terbatas, perlu surat/izin pembina untuk kegiatan tertentu.

**Bu Made, dosen (pengguna sekunder).** Perlu ruangan untuk rapat atau kelas tambahan. Tujuan: memesan cepat dan mendapat kepastian.

**Dedi, petugas sarpras (pengguna operasional).** Mengelola jadwal ruangan. Tujuan: mencegah bentrok, menangani kasus khusus, merekap penggunaan.

### Peran dan hak akses

| Aksi | Peminjam (mahasiswa/dosen/staf) | Pengelola ruangan | Admin sistem |
|------|-------------------------------|-------------------|--------------|
| Melihat daftar ruangan dan slot tersedia | Ya | Ya | Ya |
| Mengajukan reservasi | Untuk diri sendiri / organisasi yang diikuti | Atas nama peminjam, dengan alasan tercatat | Tidak otomatis |
| Membatalkan reservasi | Milik sendiri, sebelum waktu mulai | Ya, dengan alasan tercatat | Tidak otomatis |
| Menyetujui / menolak pengajuan | Tidak | Ruangan yang dikelola | Tidak otomatis |
| Mengelola data ruangan, jam, aturan | Tidak | Ruangan yang dikelola | Konfigurasi sistem |
| Memblokir slot (perawatan, kuliah, acara kampus) | Tidak | Ya | Ya |
| Mengelola akun dan peran | Tidak | Tidak | Ya, dengan audit log |
| Melihat rekap penggunaan | Riwayat sendiri | Ruangan yang dikelola | Semua |

**[Asumsi]** Pembina/dosen pendamping organisasi dapat menjadi pemberi rekomendasi; keputusannya masuk pertanyaan terbuka (bagian 17).

## 5. Scope rilis 1.0 dan prioritas

### Dalam scope
Login, daftar ruangan beserta aturannya, pencarian ketersediaan, pengajuan reservasi (organisasi dan pribadi), persetujuan oleh pengelola, status dan konfirmasi, pembatalan, notifikasi, blokir slot oleh pengelola, rekap penggunaan, tampilan ponsel (web responsif).

### Di luar scope
Pembayaran/biaya sewa, pemesanan peralatan atau konsumsi, check-in dengan QR, reservasi lintas kampus, rekomendasi ruangan berbasis AI, aplikasi native, integrasi penuh dengan sistem akademik, reservasi berulang otomatis.

### Prioritas

| Kategori | Item |
|----------|------|
| **Must-have** | Alokasi tanpa bentrok; pengajuan dan status; persetujuan pengelola; pembatalan; hak akses; blokir slot |
| **High-want** | Notifikasi email/WhatsApp; kalender mingguan per ruangan; ekspor rekap |
| **Nice-to-have** | Reservasi berulang; QR check-in; tema tampilan; permintaan fasilitas tambahan |

Setiap pengurangan scope dicatat di riwayat versi beserta dampaknya.

## 6. Alur utama

**Peminjam:** Masuk → Cari ruangan (tanggal, waktu, kapasitas, jenis) → Pilih slot → Isi detail kegiatan → Konfirmasi pengajuan → Lihat status.

**Pengelola:** Terima pengajuan → Periksa detail dan jadwal → Setujui / Tolak (dengan alasan) → Peminjam diberi tahu.

| Tahap | Respons sistem |
|-------|----------------|
| Mencari | Hanya slot yang benar-benar tersedia ditampilkan; aturan ruangan terlihat. |
| Mengajukan | Ketersediaan dicek ulang saat konfirmasi; jika baru saja dipesan orang lain, pengajuan gagal dengan alasan dan tawaran slot lain. |
| Menunggu | Slot ditahan untuk pengajuan ini sehingga tidak bisa diajukan pihak lain. |
| Diputuskan | Status berubah, peminjam diberi tahu, riwayat tercatat. |
| Dipakai / selesai | Reservasi berstatus selesai setelah waktu berakhir. |

## 7. Kebutuhan fungsional

### Akses (AK)

| ID | Kebutuhan |
|----|-----------|
| AK-01 | Pengguna harus login sebelum mengajukan, melihat, atau membatalkan reservasi. Melihat daftar ruangan dan jadwal ketersediaan boleh dibuka tanpa login **[Asumsi: diputuskan bersama pengelola]**. |
| AK-02 | Peran (peminjam, pengelola, admin) menentukan aksi yang diizinkan sesuai tabel bagian 4. Akses di luar hak ditolak di server, bukan hanya disembunyikan di tampilan. |
| AK-03 | Login memakai akun kampus (SSO) bila tersedia; bila tidak, akun lokal dengan password yang disimpan sebagai hash. Percobaan login gagal dibatasi. |
| AK-04 | Keluar mencabut sesi di server. |

### Ruangan dan ketersediaan (RU)

| ID | Kebutuhan |
|----|-----------|
| RU-01 | Setiap ruangan memiliki nama, lokasi (gedung/lantai), kapasitas, fasilitas, jam operasional, pengelola, dan aturan (butuh persetujuan atau tidak, durasi maksimum, jenis kegiatan yang diizinkan). |
| RU-02 | Peminjam dapat mencari ruangan berdasarkan tanggal, jam mulai-selesai, kapasitas minimum, dan jenis ruangan. Hasil hanya menampilkan ruangan yang tersedia pada rentang itu. |
| RU-03 | Kalender mingguan per ruangan menampilkan slot terpakai (tanpa membuka detail pribadi peminjam lain), diblokir, dan tersedia. |
| RU-04 | Pengelola dapat memblokir slot atau rentang waktu (jadwal kuliah, perawatan, acara kampus) dengan alasan. Blokir diperlakukan sebagai slot tidak tersedia. |

### Reservasi (RS)

| ID | Kebutuhan |
|----|-----------|
| RS-01 | Peminjam yang sudah login dapat mengajukan satu ruangan untuk satu rentang waktu per transaksi. |
| RS-02 | Formulir meminta: ruangan, tanggal, jam mulai dan selesai, jenis keperluan (organisasi / pribadi), nama kegiatan, jumlah peserta, dan untuk keperluan organisasi nama organisasi serta penanggung jawab. Lampiran surat/izin opsional atau wajib sesuai aturan ruangan **[Asumsi]**. |
| RS-03 | Sistem memvalidasi input: waktu mulai harus sebelum selesai, di dalam jam operasional, tidak di masa lalu, tidak melebihi durasi maksimum, dan jumlah peserta tidak melebihi kapasitas. Kolom bermasalah ditandai dengan alasan. |
| RS-04 | Ketersediaan dicek ulang saat pengajuan dikirim. Bila slot sudah tidak tersedia, pengajuan gagal, alasan dijelaskan, dan slot alternatif ditawarkan. |
| RS-05 | Setelah pengajuan berhasil, peminjam menerima ID reservasi, ruangan, waktu, dan status. Ruangan tanpa persetujuan langsung berstatus Terkonfirmasi; ruangan dengan persetujuan berstatus Menunggu persetujuan. |
| RS-06 | Mengirim pengajuan dua kali (klik ganda atau retry) tidak membuat reservasi ganda. |
| RS-07 | Peminjam dapat melihat daftar reservasi sendiri beserta status dan riwayat perubahan. |

### Persetujuan (AP)

| ID | Kebutuhan |
|----|-----------|
| AP-01 | Pengelola melihat antrean pengajuan untuk ruangan yang ia kelola, diurutkan dari yang paling dekat waktu pakainya. |
| AP-02 | Pengelola dapat menyetujui atau menolak. Penolakan wajib menyertakan alasan yang ditampilkan kepada peminjam. |
| AP-03 | Pengajuan yang tidak diputuskan sampai batas waktu tertentu sebelum waktu mulai (usulan: 24 jam) berstatus Kedaluwarsa dan slot dilepas; peminjam diberi tahu. |
| AP-04 | Persetujuan memeriksa ulang bentrok dengan blokir atau reservasi terkonfirmasi lain sebelum status berubah. |

### Pembatalan (PB)

| ID | Kebutuhan |
|----|-----------|
| PB-01 | Peminjam dapat membatalkan reservasi sendiri sebelum waktu mulai (batas minimal waktu pembatalan ditentukan aturan ruangan). Slot kembali tersedia. |
| PB-02 | Pengelola dapat membatalkan reservasi apa pun di ruangannya dengan alasan wajib; peminjam diberi tahu. |
| PB-03 | Setiap pembatalan mencatat siapa, kapan, dan alasannya. |

### Notifikasi (NT)

| ID | Kebutuhan |
|----|-----------|
| NT-01 | Peminjam diberi tahu saat pengajuan diterima, disetujui, ditolak, dibatalkan pengelola, atau kedaluwarsa. Pengelola diberi tahu saat ada pengajuan baru. |
| NT-02 | Kegagalan notifikasi tidak mengubah status reservasi. Status tetap dapat dilihat di aplikasi. |

### Administrasi dan laporan (AD)

| ID | Kebutuhan |
|----|-----------|
| AD-01 | Admin mengelola akun, peran, dan penugasan pengelola per ruangan; setiap perubahan tercatat di audit log. |
| AD-02 | Pengelola dapat melihat rekap penggunaan per ruangan dan periode (jumlah reservasi, jam terpakai, pembatalan) dan mengekspornya ke CSV. |

## 12. Kebutuhan nonfungsional dan keamanan

| ID | Ketentuan |
|----|-----------|
| NF-01 | Performa: 95% pencarian ketersediaan selesai ≤ 2 detik pada data representatif (target usulan, diukur sebelum diklaim). |
| NF-02 | Kapasitas: sistem tetap memenuhi target di atas pada 200 pengguna bersamaan (usulan; sesuaikan dengan data jumlah sivitas dan puncak penggunaan). |
| NF-03 | Keandalan: tidak ada reservasi ganda pada uji concurrency; data dan status bertahan setelah restart. |
| NF-04 | Tampilan: responsif pada lebar 390 px tanpa scroll horizontal; kontrol utama dapat dijangkau keyboard dan sentuhan. |
| NF-05 | Keterlacakan: setiap perubahan status dan tindakan pengelola/admin tercatat di audit log. |
| SEC-01 | Peminjam hanya dapat melihat dan mengubah reservasi miliknya; akses akun lain ditolak. |
| SEC-02 | Password (jika akun lokal) disimpan sebagai hash; sesi memakai cookie HttpOnly/Secure; HTTPS wajib di produksi. |
| SEC-03 | Secret tidak disimpan di kode, prompt, atau log; pengujian memakai data sintetis. |
| SEC-04 | Data pribadi dikumpulkan seperlunya; lama simpan riwayat reservasi dan lampiran ditetapkan bersama pihak kampus sebelum implementasi. |
| SEC-05 | Lampiran (jika ada) dibatasi jenis dan ukuran serta tidak dieksekusi. |

## 13. Integrasi dan dependensi

| Dependensi | Keputusan yang perlu disepakati |
|-----------|----------------------------------|
| Sistem identitas kampus (SSO) | Tersedia atau tidak; atribut yang dibagikan (nama, email, peran). Jika tidak ada: akun lokal dengan impor daftar pengguna. |
| Data ruangan dan jadwal kuliah | Sumber kebenaran (source of truth) dan cara pembaruan: impor berkala atau input manual oleh pengelola. |
| Layanan notifikasi (email / WhatsApp) | Saluran yang disetujui kampus; bila gagal reservasi tetap berlaku. |

Pengujian awal memakai mock dan data sintetis sebelum integrasi nyata.

## 14. Release criteria

| Dimensi | Kriteria | Cara verifikasi |
|---------|----------|-----------------|
| Fungsional | Semua kebutuhan Must-have terpenuhi dan lulus acceptance test | Test otomatis dan manual |
| Reliability | Tidak ada reservasi ganda pada concurrency test; retry tidak menggandakan | Uji konflik dan retry |
| Performance | 95% pencarian ≤ 2 detik pada data representatif | Uji response time |
| Usability | ≥ 85% peserta uji menyelesaikan reservasi tanpa bantuan | Usability test dengan mahasiswa dan dosen |
| Supportability | Pengelola dapat mencari reservasi dan alasan penolakan/pembatalan lewat ID | Simulasi penanganan laporan |
| Keamanan | Akses lintas akun dan lintas peran ditolak; tidak ada secret di repo | Test negatif dan secret scanning |
| Operasional | Prosedur backup, kontak penanggung jawab, dan panduan pengelola tersedia | Review operasional |

## 17. Pertanyaan terbuka dan keputusan yang diperlukan

| # | Pertanyaan | Pemutus |
|---|-----------|---------|
| 1 | Ruangan apa saja yang masuk rilis 1.0 dan siapa pengelola tiap ruangan? | Sarpras / BAAK |
| 2 | Ruangan mana yang perlu persetujuan dan mana yang langsung terkonfirmasi? | Pengelola, pimpinan |
| 3 | Apakah ada akun kampus/SSO yang dapat dipakai? | IT kampus |
| 4 | Apakah jadwal kuliah dapat diimpor atau harus diblokir manual? | Akademik, IT |
| 5 | Apakah pembina organisasi perlu memberi rekomendasi atau persetujuan berjenjang? | Kemahasiswaan |
| 6 | Apakah surat/izin wajib dilampirkan, dan untuk jenis kegiatan apa? | Kemahasiswaan, pengelola |
| 7 | Berapa batas reservasi aktif, jarak pemesanan ke depan, dan batas pembatalan? | Pengelola |
| 8 | Apakah keperluan pribadi diizinkan di semua ruangan atau hanya jenis tertentu? | Pimpinan |
| 9 | Saluran notifikasi yang disetujui (email, WhatsApp)? | Pengelola, IT |
| 10 | Lama penyimpanan data reservasi dan lampiran? | Pimpinan, IT |

## 18. Jadwal dan risiko

**Jadwal usulan** (sesuaikan dengan target penyelesaian tugas/proyek atau awal semester):

| Minggu | Kegiatan |
|--------|----------|
| 1–2 | Riset awal, wawancara, concept testing prototype |
| 3 | Review PRD bersama engineering, QA, design, pengelola |
| 4–6 | Implementasi per tugas kecil dan testing |
| 7 | Pilot terbatas pada beberapa ruangan |

| Risiko | Dampak | Penanganan |
|--------|--------|------------|
| Data jadwal kuliah tidak akurat | Bentrok dengan kelas | Mulai dari blokir manual; verifikasi dengan akademik |
| Pengelola lambat memproses | Target waktu keputusan gagal | Kedaluwarsa otomatis, notifikasi, aturan tanpa persetujuan untuk ruangan tertentu |
| Aturan kampus berbeda antar unit | Scope melebar | Aturan per ruangan yang dapat dikonfigurasi; hindari versi khusus |
| Adopsi rendah | Pengguna tetap memakai chat/surat | Pilot, sosialisasi, alur singkat |
| Data pribadi bocor | Kerugian bagi pengguna | Hak akses ketat, audit log, retensi disepakati |

## 19. Riwayat versi

| Versi | Tanggal | Perubahan | Alasan |
|-------|---------|-----------|--------|
| 0.1 | 19 Oktober 2026 | Draf awal | Disusun dari permintaan pemilik produk dan acuan PRD kuliah; menunggu riset dan review |
