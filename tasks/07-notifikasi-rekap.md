# Tugas 07: Notifikasi dan rekap

## Tujuan
Notifikasi perubahan status, manajemen akun/peran oleh admin, dan rekap penggunaan.

## Baca dulu
AGENTS.md; docs/PRD.md bagian 7 NT-01, NT-02, AD-01, AD-02; docs/ACCEPTANCE.md AC-NT-01

## Batas perubahan
Antarmuka notifikasi dengan implementasi mock (log/email dummy), pengelolaan akun dan peran oleh admin, rekap per ruangan dan periode, ekspor CSV. Saluran notifikasi nyata belum diputuskan (PRD bagian 17 no. 9).

## Dependensi
Tugas 02 s.d. 06.

## Bukti selesai
Test: tiap perubahan status memicu notifikasi yang benar; kegagalan notifikasi tidak mengubah status (AC-NT-01); perubahan peran tercatat di audit log; rekap dan CSV sesuai data uji.
