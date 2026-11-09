@echo off
cd /d "%~dp0"
title SIRU Preview - http://localhost:3000
set PORT=3000
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Server sudah berjalan di http://localhost:%PORT%
  start "" "http://localhost:%PORT%"
  exit /b 0
)
echo ============================================
echo  SIRU - Sistem Reservasi Ruangan
echo  Preview lokal : http://localhost:%PORT%
echo  Login dengan akun di .dev-credentials.json
echo  Tutup jendela ini untuk menghentikan server.
echo ============================================
echo.
call "C:\Program Files\nodejs\npm.cmd" run dev
echo.
echo Server berhenti. Tekan tombol apa saja untuk menutup jendela ini.
pause > nul
