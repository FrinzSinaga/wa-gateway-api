/**
 * wa_client.js — Klien WhatsApp Gateway untuk Node.js
 *
 * Pakai:
 *   const Wa = require('./wa_client');
 *   await Wa.send('6281234567890', 'Halo');
 *
 * Butuh: Node 18+ (pakai fetch bawaan, tidak perlu install apa pun)
 */

const WaClient = {
  BASE_URL: process.env.WA_GATEWAY_URL || 'http://localhost:5000',
  API_KEY: process.env.WA_GATEWAY_KEY || '',
  TIMEOUT_MS: 120000, // JANGAN turunkan — jeda anti-ban bisa 25 detik
  MAX_FILE_BYTES: 15 * 1024 * 1024,

  /**
   * Status gateway + kuota.
   * @returns {Promise<{ok:boolean,state:string,label:string,pushname:?string,wid:?string,quota:?object,error:?string}>}
   */
  async health() {
    const r = await this.request('GET', '/status');
    const out = { ok: false, state: 'offline', label: 'Offline', pushname: null, wid: null, quota: null, error: null };

    if (r.status === 401 || r.status === 403) {
      out.state = 'bad_key';
      out.label = 'API Key salah';
      out.error = r.error;
      return out;
    }
    if (!r.ok) {
      out.error = r.error;
      return out;
    }

    const d = r.data;
    out.ok = true;
    out.state = d.state || 'unknown';
    out.pushname = d.pushname || null;
    out.wid = d.wid || null;
    out.quota = d.quota || null;
    out.label = {
      connected: `Tersambung${d.pushname ? ' (' + d.pushname + ')' : ''}`,
      connecting: 'Menunggu koneksi',
      qr: 'Menunggu scan QR',
      unavailable: 'Gateway restart / tidak terjangkau',
    }[out.state] || `Status: ${out.state}`;
    return out;
  },

  /** Kirim pesan teks. */
  async send(number, message) {
    return this.request('POST', '/send', { number: this.normalize(number), message });
  },

  /**
   * Kirim file + caption opsional.
   * @param {string} number  Nomor internasional tanpa '+'
   * @param {string} filePath Path absolut file lokal
   */
  async sendFile(number, filePath, caption = '', filename = null) {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(filePath)) {
      return this.fail('File tidak ditemukan: ' + path.basename(filePath));
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return this.fail('File kosong.');
    if (stat.size > this.MAX_FILE_BYTES) {
      return this.fail(`File terlalu besar (${(stat.size / 1048576).toFixed(1)} MB). Maksimal 15 MB.`);
    }

    const mime = this.detectMime(filePath);
    if (!mime) return this.fail('Tipe file tidak dikenali: ' + path.basename(filePath));

    const data = fs.readFileSync(filePath).toString('base64');
    return this.request('POST', '/send-media', {
      number: this.normalize(number),
      file: `data:${mime};base64,${data}`,
      caption,
      filename: filename || path.basename(filePath),
    });
  },

  /** Kirim ke banyak nomor sekaligus. Maks 500. */
  async blast(numbers, message) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return this.fail('numbers harus array yang tidak kosong.');
    }
    if (numbers.length > 500) return this.fail('Maksimal 500 nomor per blast.');
    return this.request('POST', '/blast', { numbers: numbers.map((n) => this.normalize(n)), message });
  },

  async blastStatus(jobId) {
    return this.request('GET', `/blast/${encodeURIComponent(jobId)}`);
  },

  async blastCancel(jobId) {
    return this.request('POST', `/blast/${encodeURIComponent(jobId)}/cancel`);
  },

  /** Ubah 08xx / +62xx / spasi menjadi format yang diterima gateway. */
  normalize(number) {
    let d = String(number).replace(/\D/g, '');
    if (d.startsWith('0')) d = '62' + d.slice(1);
    else if (d.startsWith('8')) d = '62' + d;
    else if (!d.startsWith('62') && !d.startsWith('1')) d = '62' + d;
    return d;
  },

  detectMime(filePath) {
    const ext = filePath.split('.').pop().toLowerCase();
    return {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf',
    }[ext] || null;
  },

  async request(method, path, payload = null) {
    if (typeof fetch !== 'function') {
      return this.fail('Butuh Node 18+ (fetch tidak tersedia).');
    }

    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (this.API_KEY) headers['x-api-key'] = this.API_KEY;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.TIMEOUT_MS);

    let res;
    try {
      res = await fetch(this.BASE_URL.replace(/\/$/, '') + path, {
        method,
        headers,
        body: payload ? JSON.stringify(payload) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err.name === 'AbortError' ? `Timeout setelah ${this.TIMEOUT_MS / 1000} detik` : err.message;
      return { ok: false, status: 0, data: null, error: msg };
    }
    clearTimeout(timer);

    let data;
    try {
      data = await res.json();
    } catch {
      return { ok: false, status: res.status, data: null, error: 'Respons bukan JSON yang valid.' };
    }

    const ok = data.success === true;
    return { ok, status: res.status, data, error: ok ? null : (data.error || `HTTP ${res.status}`) };
  },

  fail(message) {
    return { ok: false, status: 0, data: null, error: message };
  },
};

module.exports = WaClient;
