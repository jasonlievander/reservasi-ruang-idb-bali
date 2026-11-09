# SIRU: dokumen repo untuk OpenCode

Paket dokumen untuk membangun sistem reservasi ruangan kampus Institut Desain dan Bisnis Bali dengan coding agent.

## Cara memakai
1. Buat proyek Next.js (atau stack lain; lalu perbarui bagian "Stack" di `AGENTS.md`), salin folder `docs/`, `tasks/`, dan `AGENTS.md` ke root proyek.
2. Isi bagian yang bertanda `[diisi]` di `docs/PRD.md` (pemilik produk) dan jawab pertanyaan terbuka di PRD bagian 17 sebelum mengunci aturan.
3. Buka OpenCode dari root proyek. Mulai dengan tugas 01 di **mode plan**:

> Baca AGENTS.md, docs/DATA.md, dan tasks/01-struktur-data.md. Jelaskan perilaku sistem, dependensi, dan asumsi yang perlu diperiksa. Tanyakan aturan yang belum jelas atau saling bertentangan. Usulkan rencana perubahan dan acceptance test. Jangan mengedit file atau menjalankan tindakan yang mengubah data.

4. Setelah rencana Anda review dan setujui, pindah ke mode **build**:

> Implementasikan hanya tugas 01 sesuai rencana yang sudah direview. Patuhi aturan di AGENTS.md. Jangan menambah fitur, memakai data nyata, atau melakukan deployment. Tambahkan test, jalankan test yang relevan, lalu laporkan file yang diubah, perintah, hasil, dan bagian yang belum terverifikasi.

5. Review diff dan hasil test, lalu lanjut ke tugas berikutnya sesuai `tasks/README.md`.

## Titik review manusia
Sebelum coding (requirement ambigu), setelah tiap tugas (diff, aturan bisnis, test negatif), sebelum UI (DESIGN.md), dan sebelum release (PRD bagian 14).
