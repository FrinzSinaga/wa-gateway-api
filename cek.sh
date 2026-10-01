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
echo -e "${YELLOW}[1/5]${NC} Node.js"
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
echo -e "${YELLOW}[2/5]${NC} File .env"
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
echo -e "${YELLOW}[3/5]${NC} Port ${PORT}"
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
fi

# --- Chromium ---
echo
echo -e "${YELLOW}[4/5]${NC} Chromium"
CHROME_BIN=$(command -v chromium 2>/dev/null || command -v chromium-browser 2>/dev/null || command -v google-chrome 2>/dev/null || command -v google-chrome-stable 2>/dev/null || echo "")
if [ -z "$CHROME_BIN" ]; then
    echo -e "  ${RED}TIDAK ADA${NC} - gateway tidak akan konek tanpa Chromium"
    echo "  sudo yum install -y chromium chromium-headless nss atk at-spi2-atk \\"
    echo "    cups-libs libdrm libxkbcommon libXcomposite libXdamage \\"
    echo "    libXrandr mesa-libgbm pango alsa-lib google-noto-sans-fonts"
else
    echo -e "  ${GREEN}OK${NC} - $CHROME_BIN"
fi

# --- Sesi WhatsApp ---
echo
echo -e "${YELLOW}[5/5]${NC} Sesi WhatsApp"
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
echo "  Carabaikan cepat:"
echo
echo "    Gateway mati?          npm start"
echo "    Perlu scan ulang?      npm run qr"
echo "    Sesi rusak?            rm -rf .wwebjs_auth && npm run qr"
echo "    Port bentrok?          lsof -i :5000  lalu  kill <PID>"
echo "    Gagal semua?           ./install.sh"
echo -e "${BLUE}==========================================================${NC}"
echo