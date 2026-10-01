#!/usr/bin/env bash
# ============================================================
#  Instalasi Otomatis WA Gateway - Linux
#
#  Jalankan:  chmod +x install.sh && ./install.sh
# ============================================================
set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

gagal() { echo -e "${RED}$1${NC}"; echo; exit 1; }

echo
echo -e "${BLUE}==========================================================${NC}"
echo -e "${BLUE}  INSTALASI WA GATEWAY (Linux)${NC}"
echo -e "${BLUE}==========================================================${NC}"
echo

# ------------------------------------------------------------
echo -e "${YELLOW}[1/6]${NC} Mengecek Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo -e "  ${RED}GAGAL: Node.js belum terpasang.${NC}"
    echo
    echo "  Untuk Rocky/Alma/CentOS:"
    echo "    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -"
    echo "    sudo yum install -y nodejs"
    echo
    echo "  Untuk Ubuntu/Debian:"
    echo "    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "    sudo apt install -y nodejs"
    echo
    echo "  Lalu jalankan ulang ./install.sh"
    echo
    exit 1
fi
echo "  Node.js: $(node --version)"

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 18 ]; then
    gagal "  Node.js harus versi 18 atau lebih baru (sekarang $NODE_MAJOR)."
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[2/6]${NC} Memastikan folder .env ada..."
if [ ! -f ".env" ]; then
    if [ ! -f ".env.example" ]; then
        gagal "  GAGAL: .env.example tidak ditemukan. Pastikan folder diekstrak lengkap."
    fi
    cp .env.example .env
    echo "  .env dibuat dari .env.example"
else
    echo "  .env sudah ada, dilewati."
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[3/6]${NC} Membuat API key acak..."
CURRENTKEY=$(grep -E '^\s*API_KEY\s*=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' ' | tr -d '"' | tr -d "'")

if [ -n "$CURRENTKEY" ]; then
    echo "  API key sudah diisi, tidak diacak ulang."
    echo "  Key: ${CURRENTKEY:0:8}..."
else
    NEWKEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if command -v sed >/dev/null 2>&1; then
        sed -i "s|^\s*API_KEY\s*=.*|API_KEY = $NEWKEY|" .env
    else
        echo "API_KEY = $NEWKEY" >> .env
    fi
    echo -e "  ${GREEN}API key baru dibuat: ${NEWKEY:0:8}...${NC}"
    echo
    echo -e "  ${YELLOW}*** SIMPAN KEY INI, DIPERLUKAN NANTI ***${NC}"
    echo
    echo "  $NEWKEY"
    echo
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[4/6]${NC} Memeriksa Chromium (wajib untuk WhatsApp Web)..."
CHROME_BIN=$(command -v chromium 2>/dev/null || command -v chromium-browser 2>/dev/null || command -v google-chrome 2>/dev/null || command -v google-chrome-stable 2>/dev/null || echo "")

if [ -z "$CHROME_BIN" ]; then
    echo -e "  ${YELLOW}PERINGATAN: Chromium tidak ditemukan.${NC}"
    echo "  WhatsApp Web butuh Chromium, tanpa itu gateway tidak akan konek."
    echo
    echo "  Untuk Rocky/Alma/CentOS:"
    echo "    sudo yum install -y chromium chromium-headless nss atk at-spi2-atk \\"
    echo "      cups-libs libdrm libxkbcommon libXcomposite libXdamage libXrandr \\"
    echo "      mesa-libgbm pango alsa-lib google-noto-sans-fonts"
    echo
    echo "  Untuk Ubuntu/Debian:"
    echo "    sudo apt install -y chromium-browser || sudo apt install -y chromium"
    echo
else
    echo "  Chromium: $CHROME_BIN"
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[5/6]${NC} Installasi dependencies (tunggu, unduh ~68 MB)..."
echo
if ! npm install; then
    echo
    echo -e "${RED}GAGAL saat npm install.${NC}"
    echo "Coba jalankan manual untuk lihat error lengkapnya:"
    echo "  npm install"
    echo
    exit 1
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[6/6]${NC} Selesai!"
echo
echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}  LANGKAH BERIKUTNYA${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo
echo "  1. Scan QR:        npm run qr"
echo "  2. Buka file:      wa-qr.png"
echo "  3. Di HP:          WhatsApp > Perangkat Tertaut > Tautkan"
echo "  4. Scan QR,       tunggu sampai muncul"
echo "  5. Jalankan:       npm start"
echo
echo -e "  ${YELLOW}JANGAN ubah urutan itu. QR harus lebih dulu.${NC}"
echo
echo -e "${GREEN}==========================================================${NC}"
echo