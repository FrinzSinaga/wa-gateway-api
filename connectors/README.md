# ============================================================
#  WHATSAPP GATEWAY — KONEKTOR MULTI-PROJECT
# ============================================================

Salin folder ini ke project mana pun yang perlu kirim WhatsApp.
Satu gateway bisa dipakai banyak project sekaligus.

## Isi folder

```
connectors/
├── README.md          ← file ini, panduan
├── php/               ← untuk project PHP (Laravel, CodeIgniter, PHP native)
│   └── wa_client.php
├── node/              ← untuk project Node.js / Express
│   └── wa_client.js
└── python/            ← untuk project Python / Flask / Django
    └── wa_client.py
```

## 1. Nilai yang dipakai semua project

```env
WA_GATEWAY_URL  = http://localhost:5000
WA_GATEWAY_KEY  = API_KEY_DARI_FILE_.env
```

Kalau project-nya jalan di komputer/server lain, ganti `WA_GATEWAY_URL`
dengan alamat gateway:

| Gateway di | URL yang dipakai project |
|---|---|
| PC yang sama | `http://localhost:5000` |
| PC lain dalam 1 jaringan | `http://192.168.x.x:5000` |
| VPS + HTTPS | `https://gateway.domainmu.com` |
| Pakai ngrok | `https://xxx.ngrok-free.app` |

## 2. Endpoint yang tersedia

Semua WAJIB kirim header `x-api-key` (atau `Authorization: Bearer`).

| Method | Path | Body | Fungsi |
|---|---|---|---|
GET  | `/status`   | — | cek koneksi + kuota |
POST | `/send`     | `number`, `message` | kirim teks |
POST | `/send-media` | `number`, `file`, `caption`, `filename` | kirim file (data URI base64) |
POST | `/blast`    | `numbers[]`, `message` | kirim massal (maks 500) |
GET  | `/blast/:id` | — | progres blast |
POST | `/blast/:id/cancel` | — | batalkan blast |

## 3. Format nomor HP

Regex gateway: `^[1-9]\d{7,15}$` (setelah semua non-digit dibuang)

| Masukan | Hasil | Status |
|---|---|---|
`6281234567890` | `6281234567890` | ✅ |
`+62 812-3456-7890` | `6281234567890` | ✅ |
`081234567890` | — | ❌ diawali `0` (harus `62...`) |
`62878` | — | ❌ < 8 digit |

Fungsi `normalize()` di masing-masing klien sudah mengubah `08...` → `628...`
sebelum mengirim.

## 4. Batasan penting

| Batas | Nilai | Kenapa penting |
|---|---|---|
Timeout | **120 detik** | Jeda anti-ban bisa 25 detik. Jangan set kecil |
Body size | 25 MB | File maks 15 MB, jadi 25 MB sudah cukup |
File maks | 15 MB | Dikirim sebagai base64 (bertambah ~33%) |
Kuota harian | 300 pesan | **DIBAGI KE SEMUA PROJECT** |
Kuota per jam | 15 (50 pesan pertama), lalu 40 | Warm-up anti-ban |

⚠️ **Kuota itu global.** Kalau project A blast 200 pesan, project B
akan langsung kena 429. Tidak ada kuota per project.

## 5. Contoh pemakaian

### PHP
```php
require_once __DIR__ . '/includes/wa_client.php';

$h = WaClient::health();
if (!$h['ok']) {
    // "Offline", "API Key salah", atau "Menunggu scan QR"
    echo 'Gateway: ' . $h['label'];
}

// Kirim teks
$res = WaClient::send('6281234567890', 'Tagihan Anda jatuh tempo.');
if (!$res['ok']) {
    error_log('WA gagal: ' . $res['error']);   // jangan diamkan
}

// Kirim PDF
$res = WaClient::sendFile('6281234567890', __DIR__ . '/invoice.pdf', 'Terlampir invoice.');
```

### Node.js
```javascript
const Wa = require('./wa_client');

const h = await Wa.health();
if (!h.ok) console.log('Gateway:', h.label);

const res = await Wa.send('6281234567890', 'Halo');
if (!res.ok) console.error('WA gagal:', res.error);
```

### Python
```python
from wa_client import WaClient

h = WaClient.health()
if not h['ok']:
    print('Gateway:', h['label'])

res = WaClient.send('6281234567890', 'Halo')
if not res['ok']:
    print('WA gagal:', res['error'])
```

## 6. Kalau project-nya di-hosting

Shared hosting / cPanel **tidak bisa** menjalankan gateway (butuh
Node.js + Chromium 24 jam). Pilih salah satu:

1. **Sewa VPS** (~$6/bulan), install gateway di sana, project pakai
   `https://gateway.domainmu.com`
2. **Jalankan di PC sendiri** — harus nyala terus, cocok untuk testing
3. **Naikkan hosting ke VPS** — gateway dan project satu server
   (paling aman, `WA_GATEWAY_URL = http://127.0.0.1:5000`)

## 7. Rotasi API key

Key ada di `D:\wa-gateway-api\.env`. Kalau diganti, **semua project
harus di-update** — tidak ada yang otomatis ikut.

Bisa juga pakai beberapa key sekaligus (pisah koma), berguna saat
transisi:

```env
API_KEY = KEY_BARU,KEY_LAMA
```

Lalu project baru pakai `KEY_BARU`, project lama biarkan saja sampai
dimigrasi. Setelah semua migrasi, hapus `KEY_LAMA`.

## 8. Kalau gateway mati

Gejala: `Failed to connect to localhost port 5000`

Cek:
```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen
```
Kalau kosong, gateway mati. Start ulang:
```powershell
cd D:\wa-gateway-api
npm start
```

Kalau sudah jalan tapi `ProtocolError: Runtime.callFunctionOn timed out`,
sesi Chrome-nya corrupt:
```powershell
Stop-Process -Id <pid> -Force
Remove-Item "D:\wa-gateway-api\.wwebjs_auth" -Recurse -Force
npm start          # akan muncul QR, scan ulang dari HP
```
