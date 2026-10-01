@echo off
REM ============================================================
REM  Periksa Gateway - diagnostic cepat
REM  Jalankan: klik 2x file ini
REM ============================================================
title Cek WA Gateway
color 0B

echo.
echo  ==========================================================
echo    CEK WA GATEWAY
echo  ==========================================================
echo.

REM --- Node.js ---
echo  [1/4] Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo    GAGAL - belum terpasang
) else (
    for /f "tokens=*" %%v in ('node --version') do echo    OK - %%v
)

REM --- .env ---
echo.
echo  [2/4] File .env
if not exist ".env" (
    echo    GAGAL - .env tidak ada
    goto :akhir
) else (
    echo    OK - .env ada
)
for /f "tokens=1,* delims==" %%a in ('findstr /b "API_KEY" ".env"') do set KEY=%%b
if "%KEY%"=="" (
    echo    PERINGATAN - API_KEY masih kosong
) else (
    echo    OK - API_KEY terisi
)

REM --- Port ---
echo.
echo  [3/4] Port 5000
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo    TIDAK ADA yang dengar di port 5000
    echo    ^- Gateway belum jalan. Jalankan: npm start
) else (
    echo    OK - ada proses dengar di port 5000
)

REM --- Sesi WhatsApp ---
echo.
echo  [4/4] Sesi WhatsApp
if exist ".wwebjs_auth" (
    dir /b ".wwebjs_auth" | findstr /v "^$" >nul
    if errorlevel 1 (
        echo    PERINGATAN - folder ada tapi kosong
        echo    ^- Jalankan: npm run qr
    ) else (
        echo    OK - sesi tersimpan
    )
) else (
    echo    BELUM ADA - belum pernah scan QR
    echo    ^- Jalankan: npm run qr
)

:akhir
echo.
echo  ==========================================================
echo  Carabaikan cepat:
echo.
echo    Gateway mati?          npm start
echo    Perlu scan ulang?      npm run qr
echo    Sesi rusak?            rmdir /s /q .wwebjs_auth ^&^& npm run qr
echo    Gagal semua?           install.cmd
echo  ==========================================================
echo.
pause
