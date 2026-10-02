# Perbaikan Error CentOS / Linux

Commit: `360489c`

## Dua error yang muncul sebelum

```
API key auth: OFF (set API_KEY di .env)

GAGAL memulai WhatsApp: Timed out after 30000 ms while trying to connect
to the browser! Only Chrome at revision r1045629 is guaranteed to work.
```

Keduanya sudah diperbaiki di kode. Sekarang tinggal jalankan di server.

---

## Langkah di server

### 1. Ambil kode terbaru

Kalau pakai git:

```bash
cd /opt/wa-gateway-api
git pull
```

Kalau hanya unduh ZIP dari GitHub, unduh ulang. Versi lama tidak punya
perbaikan ini.

### 2. Pastikan .env ada dan API_KEY terisi

```bash
cd /opt/wa-gateway-api
cp .env.example .env

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Salin hasilnya ke `API_KEY` di `.env`, tanpa tanda kutip:

```env
APP_PORT = 5000
WEBHOOK_URL =
API_KEY = <hasil random di atas>
```

Cek sudah benar:

```bash
grep API_KEY .env
```

Kalau outputnya `API_KEY =` (kosong), gateway akan hidup tanpa autentikasi.

### 3. Jalankan installer

```bash
chmod +x install.sh cek.sh
./install.sh
```

Yang dilakukan installer:

1. Cek Node.js minimal versi 18.
2. Buat `.env` kalau belum ada.
3. Mengacak API key kalau masih kosong.
4. **Memasang Chromium + library runtime** kalau belum ada.
5. **Smoke test Chromium headless.**
6. Mencatat path Chromium ke `CHROME_BIN` di `.env`.
7. `npm install`.

Nomor 4 dan 5 adalah bagian penting. Library runtime yang kurang adalah
penyebab nomor satu Chromium gagal start di CentOS:

```bash
sudo dnf install -y chromium nss atk at-spi2-atk cups-libs libdrm \
  libxkbcommon libXcomposite libXdamage libXrandr mesa-libgbm pango \
  alsa-lib google-noto-sans-fonts
```

### 4. Scan QR

```bash
npm run qr
```

File QR jadi di `wa-qr.png`. Karena ini server tanpa display, buka file itu
dari PC lokal:

```bash
# dari PC lokal
scp root@IP_SERVER:/opt/wa-gateway-api/wa-qr.png .
```

Baru scan dengan WhatsApp di HP.

### 5. Jalankan gateway

```bash
npm start
```

Perhatikan baris startup:

```
App listening on http://localhost:5000
Browser        : /usr/bin/chromium
Platform       : linux x64 | launch timeout 120000ms
API key auth: ON
```

Kalau `Browser` menulis `(bawaan Puppeteer)` berarti Chromium tidak ditemukan.
Isi manual di `.env`:

```env
CHROME_BIN = /usr/bin/chromium
```

### 6. Verifikasi

```bash
curl -H "x-api-key: API_KEY_KAMU" http://127.0.0.1:5000/status
```

Harus berisi `"state":"connected"`.

---

## Kalau masih timeout

```bash
./cek.sh
```

Skrip itu akan mengecek library yang hilang lewat `ldd`, menjalankan smoke
test headless, cek ffmpeg, dan mencoba `/status`.

Kalau `./cek.sh` bilang smoke test gagal, tapi `ldd` tidak menunjukkan
`not found`, tampilkan log detail Chromium:

```bash
PUPPETEER_DUMPIO=true npm start 2>&1 | tee log-chromium.txt
```

Kalau server memang lambat, naikkan batas waktu:

```bash
PUPPETEER_TIMEOUT=180000 npm start
```

atau permanen di `.env`:

```env
PUPPETEER_TIMEOUT = 180000
```

---

## Opsi .env baru

Semua opsional, hanya perlu diisi kalau ada masalah:

| Variabel | Default | Fungsi |
|---|---|---|
| `CHROME_BIN` | autodetect | Path Chromium kalau tidak di lokasi standar |
| `PUPPETEER_TIMEOUT` | `120000` | Batas tunggu browser connect (ms) |
| `PUPPETEER_PROTOCOL_TIMEOUT` | `180000` | Batas tunggu balasan CDP (ms) |
| `PUPPETEER_DUMPIO` | `false` | `true` = tampilkan log detail Chromium |

---

## Catatan CentOS 7

CentOS 7 sudah habis masa dukungannya. Paket Chromium di repo resminya
sangat lama dan sering tidak bisa start. Kalau server masih CentOS 7,
pindahkan ke Rocky Linux 9 atau Alma Linux 9:

```bash
cat /etc/centos-release
```

Kalau hasilnya `CentOS Linux 7`, itu penyebabnya.

---

## systemd (setelah status sudah connected)

```bash
cat >/etc/systemd/system/wa-gateway.service <<'EOF'
[Unit]
Description=WA Gateway API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wa-gateway-api
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/wa-gateway.log
StandardError=append:/var/log/wa-gateway.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable wa-gateway
systemctl start wa-gateway
systemctl status wa-gateway
```

Lihat log:

```bash
journalctl -u wa-gateway -f
tail -f /var/log/wa-gateway.log
```

---

## Sesudah gateway online di VPS

`192.168.12.61` hanya bisa diakses dari jaringan lokal. Dari hosting
 publik, arahkan ke domain HTTPS:

```php
// config/local.php
'wa_gateway_url' => 'https://gateway.domain.com',
'wa_gateway_key' => 'API_KEY_YANG_SAMA',
```

Atau kalau IP publik server langsung:

```php
'wa_gateway_url' => 'http://IP_PUBLIC:5000',
```

Kalau untuk production, letakkan Nginx di depan gateway, tutup port 5000
dari firewall, dan layani HTTPS. Jangan expose port 5000 langsung.