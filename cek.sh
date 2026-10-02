#!/usr/bin/env bash
# ============================================================
#  Cek WA Gateway - diagnosis cepat (Linux)
#  Jalankan: chmod +x cek.sh && ./cek.sh
# ============================================================
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

echo
echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}  CEK WA GATEWAY${NC}"
echo -e "${BLUE}==========================================================${NC}"
echo

# --- Node.js ---
echo -e "${YELLOW}[1/6]${NC} Node.js"
if command -v node >/dev/null 2>&1; then
    echo -e "  ${GREEN}OK${NC} - $(node --version)"
    NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "  ${RED}PERINGATAN${NC} - butuh versi 18+, sekarang $NODE_MAJOR"
    fi
else
    echo -e "  ${RED}GAGAL${NC} - belum terpasang"
fi

# --- .env ---
echo
echo -e "${YELLOW}[2/6]${NC} File .env"
if [ ! -f ".env" ]; then
    echo -e "  ${RED}GAGAL${NC} - .env tidak ada (jalankan ./install.sh)"
else
    echo -e "  ${GREEN}OK${NC} - .env ada"
    KEY=$(grep -E '^\s*API_KEY\s*=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' ' | tr -d '"' | tr -d "'")
    if [ -z "$KEY" ]; then
        echo -e "  ${RED}PERINGATAN${NC} - API_KEY kosong, semua request akan diterima tanpa auth!"
    else
        echo -e "  ${GREEN}OK${NC} - API_KEY terisi (${KEY:0:8}...)"
    fi
fi

# --- Port ---
PORT=$(grep -E '^\s*APP_PORT\s*=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' ' | tr -d '"' | tr -d "'")
PORT=${PORT:-5000}
echo
echo -e "${YELLOW}[3/6]${NC} Port ${PORT}"
if command -v ss >/dev/null 2>&1; then
    LISTEN=$(ss -tlnp 2>/dev/null | grep ":${PORT} " || true)
elif command -v netstat >/dev/null 2>&1; then
    LISTEN=$(netstat -tlnp 2>/dev/null | grep ":${PORT} " || true)
else
    LISTEN=""
fi

if [ -z "$LISTEN" ]; then
    echo -e "  ${RED}TIDAK ADA${NC} yang dengar di port ${PORT}"
    echo "  Jalankan: npm start"
else
    echo -e "  ${GREEN}OK${NC} - ada proses dengar di port ${PORT}"
    echo "  $LISTEN" | sed 's/^/    /'

    # Kalau server sudah hidup, tanya statusnya langsung.
    if [ -n "$KEY" ]; then
        echo "  Status API:"
        RESP=$(curl -s -m 10 -H "x-api-key: $KEY" "http://127.0.0.1:${PORT}/status" 2>/dev/null || echo "")
        if [ -n "$RESP" ]; then
            echo "$RESP" | sed 's/^/    /'
        else
            echo "    (tidak bisa menghubungi /status)"
        fi
    fi
fi

# --- Chromium ---
echo
echo -e "${YELLOW}[4/6]${NC} Chromium"
CHROME_BIN=$(command -v chromium 2>/dev/null || command -v chromium-browser 2>/dev/null || command -v google-chrome 2>/dev/null || command -v google-chrome-stable 2>/dev/null || echo "")

# CHROME_BIN dari .env menang kalau diisi.
ENV_CHROME=$(grep -E '^\s*CHROME_BIN\s*=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' ' | tr -d '"' | tr -d "'")
if [ -n "$ENV_CHROME" ] && [ -x "$ENV_CHROME" ]; then
    CHROME_BIN="$ENV_CHROME"
fi

if [ -z "$CHROME_BIN" ]; then
    echo -e "  ${RED}TIDAK ADA${NC} - gateway tidak akan konek tanpa Chromium"
    echo "  Rocky/Alma/CentOS : sudo dnf install -y chromium nss atk at-spi2-atk cups-libs \\"
    echo "    libdrm libxkbcommon libXcomposite libXdamage libXrandr mesa-libgbm \\"
    echo "    pango alsa-lib google-noto-sans-fonts"
    echo "  Ubuntu/Debian     : sudo apt install -y chromium-browser"
else
    echo -e "  ${GREEN}OK${NC} - $CHROME_BIN"
    echo "  Versi: $("$CHROME_BIN" --version 2>/dev/null || echo 'tidak terbaca')"

    # Library hilang = penyebab utama timeout saat launch.
    MISSING=$("$CHROME_BIN" --version >/dev/null 2>&1; ldd "$CHROME_BIN" 2>/dev/null | grep "not found" || true)
    if [ -n "$MISSING" ]; then
        echo -e "  ${RED}Library hilang:${NC}"
        echo "$MISSING" | sed 's/^/    /'
        echo "  Pasang paket di atas sesuai distro."
    else
        echo -e "  ${GREEN}Library${NC} - lengkap"
    fi

    # Smoke test: sama persis dengan yang Puppeteer lakukan.
    if "$CHROME_BIN" --headless --no-sandbox --disable-gpu --dump-dom about:blank >/dev/null 2>&1; then
        echo -e "  ${GREEN}Smoke test${NC} - Chromium bisa jalan headless"
    else
        echo -e "  ${RED}Smoke test GAGAL${NC} - Chromium tidak bisa jalan headless"
        echo "  Ini akan memunculkan 'Timed out while trying to connect to the browser'."
        echo "  Perbaiki library dulu, atau lihat log:"
        echo "    PUPPETEER_DUMPIO=true npm start"
    fi
fi

# --- FFmpeg (opsional) ---
echo
echo -e "${YELLOW}[5/6]${NC} FFmpeg (opsional)"
if command -v ffmpeg >/dev/null 2>&1; then
    echo -e "  ${GREEN}OK${NC} - $(command -v ffmpeg)"
else
    echo -e "  ${YELLOW}TIDAK ADA${NC} - hanya video/audio yang terpengaruh"
    echo "  Teks, gambar, dan PDF tetap terkirim. Pasang: sudo dnf install -y ffmpeg"
fi

# --- Sesi WhatsApp ---
echo
echo -e "${YELLOW}[6/6]${NC} Sesi WhatsApp"
if [ -d ".wwebjs_auth" ]; then
    if [ -n "$(ls -A .wwebjs_auth 2>/dev/null)" ]; then
        echo -e "  ${GREEN}OK${NC} - sesi tersimpan"
    else
        echo -e "  ${YELLOW}PERINGATAN${NC} - folder ada tapi kosong"
        echo "  Jalankan: npm run qr"
    fi
else
    echo -e "  ${YELLOW}BELUM ADA${NC} - belum pernah scan QR"
    echo "  Jalankan: npm run qr"
fi

echo
echo -e "${BLUE}==========================================================${NC}"
echo "  Cara circumvent cepat:"
echo
echo "    Gateway mati?          npm start"
echo "    Perlu scan ulang?      npm run qr"
echo "    Sesi rusak?            rm -rf .wwebjs_auth && npm run qr"
echo "    Port bentrok?          lsof -i :5000  lalu  kill <PID>"
echo "    Timeout saat start?    PUPPETEER_DUMPIO=true npm start"
echo "    Diagnosis lengkap?     ./cek.sh"
echo "    Install ulang?         ./install.sh"
echo -e "${BLUE}==========================================================${NC}"
echo