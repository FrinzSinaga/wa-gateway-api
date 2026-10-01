# ============================================================
#  PANDUAN: Menjalankan WA Gateway di Komputer Teman
# ============================================================

Panduan ini untuk installsfrom nol. Kalau temanmu sudah punya Node.js,
lewat saja ke Langkah 3.

Waktu-needed: ± 30 menit, sebagian besar menunggu download.


## Yang Dibutuhkan

| Kebutuhan | Detail | Wajib? |
|---|---|---|
| PC / Laptop | Windows 10/11, RAM minimal 4 GB | Ya |
| Node.js | Versi 18 atau lebih baru | Ya |
| WhatsApp di HP | Untuk scan QR | Ya |
| Koneksi internet | Stabil, tidak perlu cepat | Ya |
| Penyimpanan | ± 500 MB kosong | Ya |
| Google Chrome | **Sudah ada di PC** (dipakai Puppeteer) | Ya |
| ffmpeg.exe | Sudah ikut dalam paket | Ya |

**Tidak perlu:** database, PHP, hosting, domain, server.


##>Required — Node.js 18+

Cek dulu di Command Prompt:

```cmd
node --version
```

Kalau muncul `v18.x.x` atau lebih baru → lanjut.
Kalau muncul error `node is not recognized` → pasang dulu:

1. Buka https://nodejs.org
2. Unduh versi **LTS** (yang hijau)
3. Install, biarkan default semua
4. **Tutup lalu buka lagi** Command Prompt
5. Ulangi `node --version`


## Langkah 1 — Salin Folder

Salin folder `wa-gateway-api` ke komputer temanmu. Letakkan di path
yang pendek, **tanpa spasi dan tanpa karakter aneh**:

```
C:\wa-gateway-api
```

> Hindari `Program Files`, `Desktop`, atau nama folder ber-spasi.
> Puppeteer sering gagal di path seperti itu.


## Langkah 2 — Buka Command Prompt di Folder Itu

Tekan `Shift + klik kanan` di dalam folder `wa-gateway-api`, pilih
**Open in Terminal** / **Buka di Terminal**.

Atau manual: buka Command Prompt, lalu ketik:

```cmd
cd C:\wa-gateway-api
```

Pastikan yang muncul di layar benar:
```
C:\wa-gateway-api>
```


## Langkah 3 — Install Dependencies

```cmd
npm install
```

Process ini mengunduh ± 68 MB. **Tunggu sampai selesai**, jangan
tekan Ctrl+C.，正常 selesai ditandai dengan baris seperti
`added 500 packages`.

> Jangan pernah menyalin `node_modules` dari PC lain —里面 berisi
> file khusus Windows/arsitektur masing-masing.


## Langkah 4 — Buat File .env

Salin `.env.example` lalu ubah namanya jadi `.env` (tanpa contoh).

Isi seperti ini:

```
APP_PORT = 5000
WEBHOOK_URL =
API_KEY = GANTI_DENGAN_KAYMU
```

Untuk membuat `API_KEY` yang acak, jalankan:

```cmd
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Salin 64 karakter yang muncul ke baris `API_KEY`.

> **Jangan pakai API key milikmu.** Kalau key-nya sama, temanmu bisa
> mengirim WA atas namamu dan memakai jatah harianmu.


## Langkah 5 — Scan QR (DONE DULU, JANGAN LANGSUNG `npm start`)

```cmd
npm run qr
```

Tunggu ± 20 detik sampai muncul:

```
QR DISIMPUL DI : C:\wa-gateway-api\wa-qr.png
```

1. Buka file `wa-qr.png` (klik dua kali)
2. Di HP: **WhatsApp → Perangkat Tertaut → Tautkan Perangkat**
3. Scan QR itu dengan kamera HP
4. Tunggu muncul `Scanner berhasil`

> **Penting:** jangan jalankan `npm start` dulu. Kalau gateway jalan
> lebih dulu, QR akan gagal karena folder sesi sedang dipakai.
>
> Kalau QR expired sebelum discan, ulangi `npm run qr`.


## Langkah 6 — Jalankan Gateway

```cmd
npm start
```

Yang diharapkan:

```
App listening on http://localhost:5000
Klien WhatsApp sedang start...
```

Berarti berhasil. **Jangan tutup jendela ini** — kalau ditutup,
gateway ikut mati.


## Langkah 7 — Cek Sudah Connected

Buka Command Prompt **baru** (jangan tutup yang lama), ketik:

```cmd
curl -H "x-api-key: API_KEY_KAMU" http://localhost:5000/status
```

Harus muncul `"state":"connected"`.

Kalau `"state":"qr"` → belum scan. Kalau `"state":"disconnected"` →
proses di Langkah 6 belum selesai start.


## Langkah 8 — Supaya Jalan Otomatis Saat PC Nyala

### Cara A — paling gampang

1. Tekan `Win + R`, ketik `shell:startup`, Enter
2. Buat file `wa-gateway.cmd` di folder yang terbuka, isi:

```cmd
@echo off
cd /d C:\wa-gateway-api
npm start
```

3. Setiap PC dinyalakan, gateway jalan otomatis

### Cara B — jalan background (lebih rapi)

1. `Win + R` → ketik `shell:startup` → Enter
2. Klik kanan di area kosong → **New → Shortcut**
3. Lokasi: `C:\Windows\System32\cmd.exe`
4. Isi kolom ".arguments":

```
/c start /min "WA-Gateway" cmd /k "cd /d C:\wa-gateway-api && npm start"
```

5. Beri nama `WA-Gateway`, selesai

> Cara B tidak membuka jendela hitam yang memenuhi layar.


## Ringkasan

```
npm install     → sekali saja, unduh 68 MB
npm run qr      → scan QR, sekali saja (kalausession masih ada, dilewati)
npm start       → setiap mau pakai
```

Kalau lupa `npm run qr`, gateway tetap jalan — hanya perlu scan ulang
kalau sesi expires (biasanya setelah HP ke-logout).


## Kalau Ada Masalah

### `node is not recognized`
Node.js belum terpasang. Ulangi Bagian "Required" di atas.

### `npm install` gagal / `EACCES permission denied`
Jalankan Command Prompt sebagai **Administrator**, lalu ulangi.

### `ProtocolError: Runtime.callFunctionOn timed out`
Sesi Chromium rusak. Reset:

```cmd
:: tutup semua jendela CMD dulu
rmdir /s /q C:\wa-gateway-api\.wwebjs_auth
npm run qr
npm start
```

### `The browser is already running for ...`
Sudah ada proses gateway jalan. Tutup semua jendela CMD, atau cari dan
matikan:

```cmd
taskkill /f /im chrome.exe
```

### Gateway jalan tapi tidak bisa diakses dari HP/computer lain
Windows Firewall memblokir. Buka **Windows Defender Firewall → Aturan
Masuk → Aturan Baru → Port → TCP 5000 → Allow**. Lalu akses dari
device lain pakai `http://IP-KOMPUTER:5000`.

### `disconnected` terus-menerus
Umumnya ini:
1. HP ke-logout dari WhatsApp Web
2. Sesi di-*revoke* dari **Perangkat Tertaut**
3. Sesi kadaluarsa (biasanya ~2 minggu)

Perbaikan: ulang Langkah 5.

### powerfully masih terhubung ke nomor lama
Hapus `.wwebjs_auth` sepenuhnya (perintah di atas), lalu scan ulang
dengan nomor yang benar.


## Kalau Temanmu Mau Kirim dari Project-nya

Tinggal copy satu file dari folder `connectors/`:

| Project-nya | File yang di-copy |
|---|---|
PHP, Laravel, CodeIgniter | `connectors/php/wa_client.php` |
Node.js, Express | `connectors/node/wa_client.js` |
Python, Flask, Django | `connectors/python/wa_client.py` |

Lalu di project-nya, isi dua nilai ini:

```env
WA_GATEWAY_URL = http://localhost:5000
WA_GATEWAY_KEY = API_KEY_YANG_SAMA_DENGAN_LANGKAH_4
```

Contoh PHP:

```php
require_once __DIR__ . '/includes/wa_client.php';

$h = WaClient::health();
if (!$h['ok']) {
    error_log('Gateway WhatsApp: ' . $h['label']);
}

$res = WaClient::send('6281234567890', 'Halo dari project saya');
if (!$res['ok']) {
    error_log('WA gagal: ' . $res['error']);
}
```

> File Python tidak butuh `pip install` — langsung jalan.
