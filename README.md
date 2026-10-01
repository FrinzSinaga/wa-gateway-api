# WA-Web Gateway API

![WA-Web Gateway API Logo](./assets/wa-web.png)

Gateway WhatsApp berbasis HTTP API. Satu gateway bisa dipakai banyak project
sekaligus — cukup panggil endpoint-nya dengan API key.

## Kebutuhan

| Kebutuhan | Detail |
|---|---|
Node.js | v18 atau lebih baru |
RAM | minimal 4 GB |
Chrome | harus sudah ada di PC |
Penyimpanan | ± 500 MB |

## Instalasi

###-windows

Ekstrak ke path pendek tanpa spasi, lalu:

```cmd
install.cmd
```

Skrip itu otomatis cek Node.js, membuat `.env`, mengacak API key, dan
menjalankan `npm install`.

### Manual

```bash
git clone https://github.com/nandasafiqalfiansyah/wa-gateway-api.git
cd wa-gateway-api
npm install
```

Salin `.env.example` jadi `.env`, lalu isi:

```env
APP_PORT = 5000
WEBHOOK_URL =
API_KEY = api_key_64_karakter_milikmu
```

Buat API key acak:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Menjalankan

```bash
npm run qr     # scan QR lewat WhatsApp > Perangkat Tertaut > Tautkan Perangkat
npm start      # jalankan gateway
npm run dev    # mode pengembangan dengan nodemon
```

> **Urutan penting:** `npm run qr` harus lebih dulu. Kalau `npm start`
> dijalankan lebih dulu, QR akan gagal karena folder sesi sedang dipakai.

Cek koneksi:

```bash
curl -H "x-api-key: API_KEY_KAMU" http://localhost:5000/status
```

Hasil baik: `"state":"connected"`.

Ada `cek.cmd` untuk diagnosis cepat — cek Node.js, `.env`, port 5000, dan
sesi WhatsApp sekaligus.

## API

Semua endpoint wajib mengirim header `x-api-key` atau
`Authorization: Bearer <key>`. Tanpa itu jawabannya `401`.

| Method | Path | Body | Fungsi |
| --- | --- | --- | --- |
GET | `/status` | — | status koneksi + kuota |
POST | `/send` | `number`, `message` | kirim teks |
POST | `/send-media` | `number`, `file`, `caption`, `filename` | kirim file (data URI base64) |
POST | `/blast` | `numbers[]`, `message` | kirim massal (maks 500) |
GET | `/blast/:id` | — | progres blast |
POST | `/blast/:id/cancel` | — | batalkan blast |

Format nomor: `^[1-9]\d{7,15}$` setelah semua non-digit dibuang.
`62` wajib di depan — `0812...` akan ditolak.

Contoh:

```bash
curl -X POST http://localhost:5000/send \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number":"6281234567890","message":"Halo"}'
```

## Memakai dari project lain

Salin satu file dari folder `connectors/`:

| Bahasa | File |
| --- | --- |
PHP / Laravel / CodeIgniter | `connectors/php/wa_client.php` |
Node.js / Express | `connectors/node/wa_client.js` |
Python / Flask / Django | `connectors/python/wa_client.py` |

Isi dua nilai ini di `.env` project:

```env
WA_GATEWAY_URL = http://localhost:5000
WA_GATEWAY_KEY = API_KEY_YANG_SAMA
```

```php
require_once __DIR__ . '/includes/wa_client.php';
$res = WaClient::send('6281234567890', 'Halo');
if (!$res['ok']) error_log('WA gagal: ' . $res['error']);
```

Panduan lengkap: [`connectors/PANDUAN-TEMAN.md`](./connectors/PANDUAN-TEMAN.md).

## Anti-ban

Diterapkan otomatis di `/send`, `/send-media`, dan `/blast`:

- Maks 300 pesan/hari dan 60/jam
- Warm-up 15 pesan/jam di jam-jam awal
- Jeda acak antar pesan
- Dedupe pesan identik
- Kuatu tersimpan di `.antiban-state.json`

> ⚠️ **Kuota itu global** — dibagi ke semua project yang memakai gateway
> yang sama. Kalau project A blast 200 pesan, project B akan kena `429`.

## Catatan keamanan

- **Jangan commit `.env`.** Sudah masuk `.gitignore`. Kalau ikut ter-push,
  generate API key baru dan rotasi key lama.
- `API_KEY` bisa berisi beberapa key dipisah koma — berguna saat transisi
  rotasi key.
- Semua route terlindungi API key. Kalau `API_KEY` kosong, auth otomatis
  dimatikan — **jangan biarkan begitu di server publik.**
- File `ffmpeg.exe` sengaja tidak disertakan (77 MB, melebihi batas wajar
  GitHub). Gateswa ini tidak memerlukannya untuk kirim teks, gambar, dan PDF.

## Deployment

Shared hosting / cPanel **tidak bisa** menjalankan gateway (butuh Node.js
24 jam + Chromium). Pilih salah satu:

1. **VPS** — Nginx sebagai reverse proxy + HTTPS, gateway di `127.0.0.1:5000`
2. **Railway / Render** — proses persistent, perlu install Chromium
3. **PC sendiri** — harus nyala terus, cocok untuk testing

## Troubleshooting

| Gejala | Penyebab & solusi |
| --- | --- |
`node is not recognized` | Node.js belum terpasang — pasang versi LTS dari nodejs.org |
`ProtocolError: Runtime.callFunctionOn timed out` | Sesi Chromium rusak — `rmdir /s /q .wwebjs_auth` lalu `npm run qr` |
`The browser is already running` | Sudah ada proses gateway — tutup semua jendela CMD |
`401 Unauthorized` | `API_KEY` tidak sama dengan yang ada di `.env` |
`Failed to connect to port 5000` | Gateway belum jalan — jalankan `npm start` |
`state: qr` | Belum scan QR — jalankan `npm run qr` |
`state: disconnected` terus | Sesi expired / di-revoke — scan ulang QR |

## Dependencies

- `express`: Web framework for Node.js.
- `whatsapp-web.js`: WhatsApp Web API wrapper.
- `body-parser`: Middleware to parse incoming request bodies.
- `cors`: Middleware for enabling Cross-Origin Resource Sharing (CORS).
- `dotenv`: Module to load environment variables from a `.env` file.
- `nodemon`: Development utility that automatically restarts the server when changes are detected.
- `qrcode-terminal`: Displays QR codes in the terminal.

## Scan QR

![Weather BMKG Logo](./assets/qrcode.png)

## is Already!

![Weather BMKG Logo](./assets/console.png)

## Features Table 📝

| Features                                    | Status |
| ------------------------------------------- | ------ |
| Image to Sticker                            | ✅     |
| Video to Sticker                            | ✅     |
| Gif to Sticker                              | ✅     |
| Sticker to Image                            | ✅     |
| Sticker to Video                            | ❎     |
| Change Sticker Name & Sticker Author        | ✅     |
| Prefix can be set in the config/config.json | ✅     |
| Supports Reply Image to Sticker             | ✅     |
| Supports Reply Video to Sticker             | ✅     |
| Supports Reply Gif to Sticker               | ✅     |
| Supports Reply Stickers to Images           | ✅     |

## Commands Table 📝

| Commands                   | Description                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| !sticker                   | Membuat Gambar/Video/Gif menjadi Stiker. Anda juga dapat mengirim Gambar/Video/Gif menjadi Stiker langsung tanpa Command. [dalam keterangan atau pesan balasan] |
| !image                     | Membuat Stiker menjadi Gambar. Anda juga dapat mengirim Stiker menjadi Gambar langsung tanpa Command. [dalam pesan balasan]                                     |
| !change <name> \| <author> | Mengubah Nama Stiker & Penulis Stiker sesuai keinginan. [dalam pesan balasan]                                                                                   |

## Contribution

Feel free to contribute by opening a pull request or reporting issues on the [GitHub repository](https://github.com/nandasafiqalfiansyah).

## buymeacoffee

<a href="https://www.buymeacoffee.com/nandasafiqx" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

## License

Licensed under the [MIT License](LICENSE).
