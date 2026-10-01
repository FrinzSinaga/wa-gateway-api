@echo off
REM ============================================================
REM  Instalasi Otomatis WA Gateway
REM  Jalankan: klik 2x file ini
REM ============================================================
title Instalasi WA Gateway
color 0B

echo.
echo  ==========================================================
echo    INSTALASI WA GATEWAY
echo  ==========================================================
echo.

REM ------------------------------------------------------------
echo  [1/5] Mengecek Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo    GAGAL: Node.js belum terpasang.
    echo.
    echo    Silakan pasang Node.js versi LTS dari:
    echo      https://nodejs.org
    echo.
    echo    Lalu BUKA ULANG file ini setelah selesai install.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODEV=%%v
echo    Node.js terdeteksi: %NODEV%

REM ------------------------------------------------------------
echo.
echo  [2/5] Memastikan folder .env ada...
if not exist ".env" (
    if not exist ".env.example" (
        echo.
        echo    GAGAL: .env.example tidak ditemukan.
        echo    Pastikan folder ini diekstrak lengkap.
        echo.
        pause
        exit /b 1
    )
    copy ".env.example" ".env" >nul
    echo    .env dibuat dari .env.example
) else (
    echo    .env sudah ada, dilewati.
)

REM ------------------------------------------------------------
echo.
echo  [3/5] Membuat API key acak...
if exist ".env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /b "API_KEY" ".env"') do set CURRENTKEY=%%b
)
if "%CURRENTKEY%"=="" set CURRENTKEY=
if not "%CURRENTKEY%"=="" (
    echo    API key sudah diisi, tidak diacak ulang.
    echo    Key: %CURRENTKEY:~0,8%...
) else (
    for /f "tokens=*" %%k in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set NEWKEY=%%k
    powershell -NoProfile -Command "$p='.env'; $c=Get-Content $p; $c=$c -replace '^API_KEY\s*=.*$','API_KEY = $env:NEWKEY'; Set-Content -Path $p -Value $c -Encoding UTF8"
    echo    API key baru dibuat: %NEWKEY:~0,8%...
    echo.
    echo    *** SIMPAN KEY INI, DIPERLUKAN LATER ***
    echo.
    echo    %NEWKEY%
    echo.
)

REM ------------------------------------------------------------
echo.
echo  [4/5] Installasi dependencies (tunggu, ini mengunduh ~68 MB)...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo    GAGAL saat npm install.
    echo    Coba buka Command Prompt sebagai Administrator, lalu:
    echo      cd /d %CD%
    echo      npm install
    echo.
    pause
    exit /b 1
)

REM ------------------------------------------------------------
echo.
echo  [5/5] Selesai!
echo.
echo  ==========================================================
echo    LANGKAH BERIKUTNYA
echo  ==========================================================
echo.
echo    1. Jalankan:  npm run qr
echo    2. Buka file:  wa-qr.png
echo    3. Di HP:      WhatsApp ^> Perangkat Tertaut ^> Tautkan
echo    4. Scan QR,   tunggu "Scanner berhasil"
echo    5. Jalankan:   npm start
echo.
echo    JANGAN ubah urutan itu. QR harus lebih dulu.
echo.
echo  ==========================================================
echo.
pause
