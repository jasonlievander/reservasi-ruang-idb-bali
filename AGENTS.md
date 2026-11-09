# SIRU

Sistem reservasi ruangan kampus Institut Desain dan Bisnis Bali. Sivitas akademika
meminjam ruangan untuk keperluan organisasi maupun pribadi; pengelola menyetujui dan
mengatur ruangan. Detail produk ada di `docs/`. Baca hanya bagian yang relevan dengan
tugas, jangan seluruh dokumen.

## Peta dokumen
- `docs/PRD.md`: tujuan, pengguna, scope, kebutuhan fungsional (AK, RU, RS, AP, PB, NT, AD), nonfungsional, release criteria
- `docs/DATA.md`: aturan bisnis (BR), status reservasi, model data, edge case
- `docs/ACCEPTANCE.md`: acceptance test (AC) dan ketertelusuran
- `docs/DESIGN.md`: design brief dan token desain (diisi pada tugas 08)
- `tasks/`: satu file per tugas; kerjakan sesuai urutan di `tasks/README.md`

## Stack dan perintah (asumsi awal, perbarui jika berubah)
- Next.js (App Router) + TypeScript, Prisma ORM, SQLite, Vitest untuk test
- Install: `npm install`
- Dev server: `npm run dev`
- Migrasi database: `npx prisma migrate dev`
- Test: `npm test`
- Lint/typecheck: `npm run lint` dan `npx tsc --noEmit`

## Aturan kerja
- Kerjakan hanya tugas di `tasks/` yang diminta. Jangan menambah fitur di luar scope PRD.
- Patuhi aturan bisnis di `docs/DATA.md` (BR-01 s.d. BR-08) dan hak akses di PRD bagian 4.
- Hak akses dan validasi ditegakkan di server, bukan hanya disembunyikan di UI.
- Alokasi slot harus eksklusif dan dijamin di server dalam satu transaksi (BR-02). Pengajuan yang sama tidak boleh membuat reservasi ganda (RS-06).
- Semua waktu memakai WITA (UTC+8) sesuai BR-08.
- Jangan mengubah requirement, aturan bisnis, atau ID. Jika ada yang ambigu atau saling bertentangan, berhenti dan tanyakan.
- Jangan menghapus atau melemahkan test agar lulus; perbaiki penyebabnya.
- Gunakan data sintetis. Jangan menaruh secret, password, atau data pribadi nyata di kode, fixture, prompt, atau log.
- Jangan melakukan deployment dan jangan menjalankan perintah yang mengubah data di luar folder proyek.
- Perubahan skema database, hak akses, atau aturan bisnis harus dijelaskan dulu dan menunggu persetujuan manusia.

## Definisi selesai satu tugas
1. Test untuk requirement terkait lulus: kasus sukses, gagal, dan input tidak valid, serta test negatif untuk hak akses.
2. Untuk tugas UI: periksa aplikasi yang berjalan memakai Agent Browser pada lebar desktop dan 390 px (tidak ada scroll horizontal, kontrol dapat dijangkau keyboard), lalu jalankan skenario AC yang terkait.
3. Tugas desain/UI memakai `docs/DESIGN.md`; jangan membuat gaya baru di luar token yang ada.
4. Laporan akhir: file yang diubah, perintah yang dijalankan beserta hasilnya, dan bagian yang belum terverifikasi.

## Skill yang tersedia
- Browser: Vercel Agent Browser (verifikasi tampilan dan alur di aplikasi yang berjalan)
- Desain: OpenCode Skills (design brief, token, alur UX, aksesibilitas, review UI); Emil Kowalski Skills (interaksi dan animasi, hanya pada tahap polish)
- Animasi tidak boleh menggantikan kejelasan status dan harus menghormati `prefers-reduced-motion`.
