@echo off
cd /d "%~dp0"
setlocal
set PORT=3000
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Server sudah berjalan di http://localhost:%PORT%
  exit /b 0
)
call "C:\Program Files\nodejs\npm.cmd" run dev > dev.out.log 2> dev.err.log
