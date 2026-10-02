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
echo -e "${YELLOW}[1/7]${NC} Mengecek Node.js..."
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
echo -e "${YELLOW}[2/7]${NC} Memastikan folder .env ada..."
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
echo -e "${YELLOW}[3/7]${NC} Membuat API key acak..."
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
echo -e "${YELLOW}[4/7]${NC} Menyiapkan Chromium (wajib untuk WhatsApp Web)..."

# Library runtime yang sering hilang di CentOS/RHEL, penyebab paling umum
# Chromium gagal start dengan pesan "Timed out while trying to connect".
DEPS_RPM="nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXrandr mesa-libgbm pango alsa-lib google-noto-sans-fonts libXScrnSaver"

if command -v chromium >/dev/null 2>&1; then
    :
elif command -v chromium-browser >/dev/null 2>&1; then
    :
elif command -v google-chrome >/dev/null 2>&1; then
    :
elif command -v google-chrome-stable >/dev/null 2>&1; then
    :
else
    echo "  Chromium belum ada, mencoba memasang..."
    echo

    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y chromium $DEPS_RPM || true
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y chromium $DEPS_RPM || true
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -y || true
        (sudo apt-get install -y chromium || sudo apt-get install -y chromium-browser) || true
        sudo apt-get install -y $DEPS_RPM || true
    fi
fi

CHROME_BIN=$(command -v chromium 2>/dev/null || command -v chromium-browser 2>/dev/null || command -v google-chrome 2>/dev/null || command -v google-chrome-stable 2>/dev/null || echo "")

if [ -z "$CHROME_BIN" ]; then
    echo -e "  ${RED}Chromium tetap tidak ditemukan.${NC}"
    echo "  Pasang manual, lalu ulangi ./install.sh"
    echo
    echo "    Rocky/Alma/CentOS : sudo dnf install -y chromium $DEPS_RPM"
    echo "    Ubuntu/Debian     : sudo apt install -y chromium-browser"
    echo "    Fedora            : sudo dnf install -y chromium-headless"
    echo
    echo "  Catatan: Chromium wajib. Tanpa itu gateway tidak akan konek."
    echo
    exit 1
fi

echo "  Chromium: $CHROME_BIN"
echo "  Versi   : $("$CHROME_BIN" --version 2>/dev/null || echo 'tidak terbaca')"

# Smoke test: benar-benar jalankan Chromium headless sekali. Kalau library
# runtime hilang, error-nya muncul di sini, bukan 30 detik kemudian saat
# gateway start.
if "$CHROME_BIN" --headless --no-sandbox --disable-gpu --dump-dom about:blank >/dev/null 2>&1; then
    echo -e "  ${GREEN}Smoke test Chromium: OK${NC}"
else
    echo -e "  ${YELLOW}Smoke test Chromium GAGAL.${NC}"
    echo "  Library runtime kemungkinan belum lengkap. Periksa:"
    echo "    ldd \"$CHROME_BIN\" | grep 'not found'"
    echo
    echo "  Rocky/Alma/CentOS : sudo dnf install -y $DEPS_RPM"
    echo
fi

# Catat path-nya ke .env supaya gateway tidak perlu menebak.
if ! grep -qE '^\s*CHROME_BIN\s*=\s*\S' .env 2>/dev/null; then
    if command -v sed >/dev/null 2>&1; then
        sed -i "s|^\s*CHROME_BIN\s*=.*|CHROME_BIN = $CHROME_BIN|" .env
    else
        echo "CHROME_BIN = $CHROME_BIN" >> .env
    fi
    echo "  CHROME_BIN dicatat di .env"
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[5/7]${NC} Menyiapkan FFmpeg (opsional, hanya untuk video/audio)..."
if command -v ffmpeg >/dev/null 2>&1; then
    echo "  ffmpeg: $(command -v ffmpeg)"
else
    if command -v dnf >/dev/null 2>&1; then
        sudo dnf install -y ffmpeg >/dev/null 2>&1 || true
    elif command -v yum >/dev/null 2>&1; then
        sudo yum install -y ffmpeg >/dev/null 2>&1 || true
    elif command -v apt-get >/dev/null 2>&1; then
        sudo apt-get install -y ffmpeg >/dev/null 2>&1 || true
    fi

    if command -v ffmpeg >/dev/null 2>&1; then
        echo -e "  ${GREEN}ffmpeg terpasang: $(command -v ffmpeg)${NC}"
    else
        echo -e "  ${YELLOW}ffmpeg tidak ada.${NC}"
        echo "  Tidak fatal: teks, gambar, dan PDF tetap bisa dikirim."
        echo "  Untuk video/audio: sudo dnf install -y ffmpeg"
    fi
fi

# ------------------------------------------------------------
echo
echo -e "${YELLOW}[6/7]${NC} Installasi dependencies (tunggu, unduh ~68 MB)..."
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
echo -e "${YELLOW}[7/7]${NC} Selesai!"
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
echo "  Kalau nanti muncul timeout saat start:"
echo "    PUPPETEER_DUMPIO=true npm start"
echo
echo -e "${GREEN}==========================================================${NC}"
echo