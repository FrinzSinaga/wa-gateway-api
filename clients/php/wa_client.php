<?php
/**
 * wa_client.php — Klien WhatsApp Gateway yang portabel.
 *
 * CARA PAKAI
 *   1. Salin file ini ke project kamu, misal: includes/wa_client.php
 *   2. Set konfigurasi di WA_CLIENT (lihat blok di bawah)
 *   3. require_once 'includes/wa_client.php';
 *
 * FILE INI TIDAK BERGANTUNG PADA PROJECT APAPUN.
 * Tidak memakai fungsi project, tidak butuh database, tidak butuh framework.
 * Hanya butuh ekstensi PHP cURL.
 *
 * SYARAT
 *   - PHP 7.4+ (atau 8.x)
 *   - ekstensi cURL aktif
 *   - gateway hidup & API key cocok
 *
 * PENTING: simpan file ini di luar document root kalau project kamu bisa
 * diakses publik, atau minimal pastikan tidak ada entry point yang mem-print
 * isi file ini. API key adalah rahasia.
 */

class WaClient
{
    /* ============================================================
     * KONFIGURASI — ganti sesuai kebutuhan
     * ============================================================ */

    /** Base URL gateway, tanpa garis miring di akhir. */
    const BASE_URL = 'http://localhost:5000';

    /** API key. Kosongkan string '' kalau gateway tidak pakai auth. */
    const API_KEY = '';

    /**
     * Timeout dalam detik.
     * Gateway punya jeda anti-ban yang bisa ~25 detik per pesan, jadi
     * JANGAN set kecil. 120 detik aman untuk semua endpoint.
     */
    const TIMEOUT = 120;

    /** Timeout koneksi (detik). Boleh kecil — ini hanya handshake TCP. */
    const CONNECT_TIMEOUT = 5;

    /** Ukuran file maksimum untuk dikirim, dalam byte. Default 15 MB. */
    const MAX_FILE_BYTES = 15 * 1024 * 1024;


    /* ============================================================
     * METODE PUBLIK
     * ============================================================ */

    /**
     * Status gateway + kuota anti-ban.
     *
     * @return array{ok:bool, status:int, data:array|null, error:?string}
     */
    public static function status(): array
    {
        return self::request('GET', '/status');
    }

    /**
     * Health check ringkas untuk ditampilkan di UI.
     * Tidak melempar exception, aman dipanggil di halaman mana pun.
     *
     * @return array{ok:bool, state:string, label:string, pushname:?string,
     *               wid:?string, quota:?array, error:?string}
     */
    public static function health(): array
    {
        $r = self::status();
        $out = [
            'ok'       => false,
            'state'    => 'offline',
            'label'    => 'Offline',
            'pushname' => null,
            'wid'      => null,
            'quota'    => null,
            'error'    => null,
        ];

        if ($r['status'] === 401 || $r['status'] === 403) {
            $out['state'] = 'bad_key';
            $out['label'] = 'API Key salah';
            $out['error'] = $r['error'];
            return $out;
        }
        if (!$r['ok']) {
            $out['error'] = $r['error'];
            return $out;
        }

        $d = $r['data'];
        $out['ok']       = true;
        $out['state']    = (string) ($d['state'] ?? 'unknown');
        $out['pushname'] = $d['pushname'] ?? null;
        $out['wid']      = $d['wid'] ?? null;
        $out['quota']    = $d['quota'] ?? null;

        $out['label'] = match ($out['state']) {
            'connected' => 'Tersambung' . ($d['pushname'] ? ' (' . $d['pushname'] . ')' : ''),
            'connecting', 'qr' => 'Menunggu scan QR',
            'unavailable' => 'Gateway restart / tidak terjangkau',
            default => 'Status: ' . $out['state'],
        };

        return $out;
    }

    /**
     * Kirim pesan teks.
     *
     * @param string $number Nomor internasional tanpa '+'. Contoh: 6281234567890
     * @param string $message Isi pesan
     */
    public static function send(string $number, string $message): array
    {
        return self::request('POST', '/send', [
            'number'  => $number,
            'message' => $message,
        ]);
    }

    /**
     * Kirim file (gambar, PDF, dokumen) + caption opsional.
     *
 * Format `file` yang diminta gateway adalah data URI base64, jadi file
 * dienkode otomatis di sini. Ukuran payload bertambah sekitar 33% karena
 * base64, dan itu sudah diabaikan gateway (batasnya 25 MB).
     *
     * @param string $number  Nomor internasional tanpa '+'
     * @param string $path    Path absolut file lokal yang mau dikirim
     * @param string $caption Caption/teks di atas file
     * @param ?string $filename Nama file yang dilihat penerima
     */
    public static function sendFile(string $number, string $path, string $caption = '', ?string $filename = null): array
    {
        // --- validasi file di sisi pemanggil, supaya errornya jelas ---
        if (!is_file($path) || !is_readable($path)) {
            return self::fail('file_not_found', 'File tidak ditemukan atau tidak bisa dibaca: ' . basename($path));
        }
        $size = filesize($path);
        if ($size === false || $size === 0) {
            return self::fail('empty_file', 'File kosong.');
        }
        if ($size > self::MAX_FILE_BYTES) {
            return self::fail('file_too_large', sprintf(
                'File terlalu besar (%.1f MB). Maksimal %d MB.',
                $size / 1048576,
                self::MAX_FILE_BYTES / 1048576
            ));
        }

        $mime = self::detectMime($path);
        if ($mime === null) {
            return self::fail('unknown_mime', 'Tidak bisa menentukan tipe file: ' . basename($path));
        }

        $data = base64_encode((string) file_get_contents($path));

        return self::request('POST', '/send-media', [
            'number'   => $number,
            'file'     => 'data:' . $mime . ';base64,' . $data,
            'caption'  => $caption,
            'filename' => $filename ?: basename($path),
        ]);
    }

    /**
     * Kirim pesan ke banyak nomor sekaligus (blast).
     *
     * PENTING: jeda antar-pesan DIATUR OLEH GATEWAY (anti-ban), bukan oleh
     * kode pemanggil. Endpoint ini hanya menerima maksimal 500 nomor dan
     * menolak nomor duplikat secara otomatis.
     *
     * ⚠️ Jangan pakai untuk pesan massal ke orang yang tidak pernah
     *    bertransaksi denganmu — itu pola yang paling cepat memicu banned.
     *
     * @param string[] $numbers
     * @return array{ok:bool, status:int, data:?array, error:?string}
     *         $data berisi 'job_id' kalau diterima (HTTP 202).
     */
    public static function blast(array $numbers, string $message): array
    {
        if (count($numbers) > 500) {
            return self::fail('too_many', 'Maksimal 500 nomor per blast.');
        }
        return self::request('POST', '/blast', [
            'numbers' => array_values($numbers),
            'message' => $message,
        ]);
    }

    /** Progres satu job blast. */
    public static function blastStatus(string $jobId): array
    {
        return self::request('GET', '/blast/' . rawurlencode($jobId));
    }

    /** Batalkan job blast yang sedang jalan. */
    public static function blastCancel(string $jobId): array
    {
        return self::request('POST', '/blast/' . rawurlencode($jobId) . '/cancel');
    }


    /* ============================================================
     * INTERNAL — tidak perlu diubah
     * ============================================================ */

    /**
     * @return array{ok:bool, status:int, data:?array, error:?string}
     */
    private static function request(string $method, string $path, ?array $payload = null): array
    {
        $url = rtrim(self::BASE_URL, '/') . $path;

        if (!function_exists('curl_init')) {
            return self::fail('no_curl', 'Ekstensi PHP cURL belum aktif di server ini.');
        }

        $ch = curl_init($url);
        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
        ];
        if (self::API_KEY !== '') {
            $headers[] = 'x-api-key: ' . self::API_KEY;
        }

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST     => strtoupper($method),
            CURLOPT_RETURNTRANSFER    => true,
            CURLOPT_HTTPHEADER        => $headers,
            CURLOPT_CONNECTTIMEOUT    => self::CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT           => self::TIMEOUT,
            CURLOPT_SSL_VERIFYPEER    => true,
            CURLOPT_SSL_VERIFYHOST    => 2,
        ]);

        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        }

        $body   = curl_exec($ch);
        $errno  = curl_errno($ch);
        $error  = curl_error($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($errno !== 0 || $body === false) {
            return [
                'ok'     => false,
                'status' => 0,
                'data'   => null,
                'error'  => $error !== '' ? $error : 'Gagal menghubungi gateway.',
            ];
        }

        $data = json_decode((string) $body, true);
        if (!is_array($data)) {
            return [
                'ok'     => false,
                'status' => $status,
                'data'   => null,
                'error'  => 'Respons gateway bukan JSON yang valid: ' . substr((string) $body, 0, 200),
            ];
        }

        $ok = !empty($data['success']);

        return [
            'ok'     => $ok,
            'status' => $status,
            'data'   => $data,
            'error'  => $ok ? null : ($data['error'] ?? 'HTTP ' . $status),
        ];
    }

    /**
     * Deteksi MIME dari ISI file (bukan dari ekstensi) — sama seperti
     * yang dilakukan gateway, supaya tidak ada ketidakcocokan.
     */
    private static function detectMime(string $path): ?string
    {
        $map = [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'image/gif'  => 'gif',
            'application/pdf' => 'pdf',
        ];

        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mime = finfo_file($finfo, $path);
                finfo_close($finfo);
                if (is_string($mime) && isset($map[$mime])) {
                    return $mime;
                }
            }
        }

        // fallback kalau ekstensi finfo tidak ada
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $byExt = [
            'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
            'webp' => 'image/webp', 'gif' => 'image/gif', 'pdf' => 'application/pdf',
        ];
        return $byExt[$ext] ?? null;
    }

    private static function fail(string $code, string $message): array
    {
        return ['ok' => false, 'status' => 0, 'data' => null, 'error' => $message];
    }
}


/* ============================================================
 * CONTOH PEMAKAIAN
 * ============================================================
 *
 * require_once __DIR__ . '/includes/wa_client.php';
 *
 * // 1. Cek koneksi (tampilkan di dashboard)
 * $h = WaClient::health();
 * echo $h['label'];                 // "Tersambung (Nama Kamu)"
 * if ($h['ok'] && !empty($h['quota'])) {
 *     echo "terkirim hari ini: {$h['quota']['dayCount']}/{$h['quota']['dailyCap']}";
 * }
 *
 * // 2. Kirim teks
 * $r = WaClient::send('6281234567890', 'Halo, tagihan Anda sudah jatuh tempo.');
 * if (!$r['ok']) {
 *     // jangan diamkan — catat supaya bisa dicek nanti
 *     error_log('WA gagal: ' . $r['error']);
 * }
 *
 * // 3. Kirim PDF invoice
 * $r = WaClient::sendFile('6281234567890', __DIR__ . '/storage/inv-001.pdf', 'Terlampir invoice.');
 *
 */
