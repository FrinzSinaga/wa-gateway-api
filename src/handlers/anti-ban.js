/**
 * src/handlers/anti-ban.js
 * Penjaga anti-ban WhatsApp.
 *
 * Prinsip: WhatsApp mendeteksi pola, bukan isi. Yang paling memicu ban:
 *   - jeda tetap / terlalu cepat antar pesan
 *   - volume tinggi mendadak
 *   - pesan identik ke banyak penerima
 * Modul ini menegakkan: jeda acak dengan batas bawah, kuota per jam & per
 * hari, dan jadwal warm-up bertahap untuk akun yang belum terhangat.
 */

const fs = require("fs");
const path = require("path");

const CONFIG = {
  // Jeda blast antar nomor (ms), diambil acak pada rentang ini.
  blastMinDelay: 7000,
  blastMaxDelay: 15000,
  // Jeda minimal antar pesan tunggal, supaya tidak dipanggil rapat-rapat.
  singleMinDelay: 3000,
  // Batas total per hari untuk semua jalur kirim.
  dailyCap: 300,
  // Batas per jam bergulir, diturunkan oleh tier warm-up.
  hourlyCap: 60,
  // Jeda tambahan sesekali agar tidak terbaca pola periodik.
  fatigueEvery: 7,
  fatigueExtra: 20000,
  // Tier warm-up: makin banyak pesan hari ini, makin longgar aturannya.
  warmupTiers: [
    { max: 50, perHour: 15, minDelay: 25000 },
    { max: 200, perHour: 40, minDelay: 12000 },
    { max: Infinity, perHour: 60, minDelay: 7000 },
  ],
};

const STATE_FILE = path.join(__dirname, "..", "..", ".antiban-state.json");

const now = () => Date.now();
const dayKey = (ts = now()) => new Date(ts).toISOString().slice(0, 10);
const hourKey = (ts = now()) => new Date(ts).toISOString().slice(0, 13);

let state = { day: dayKey(), dayCount: 0, hours: {} };

try {
  if (fs.existsSync(STATE_FILE)) {
    const loaded = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (loaded && typeof loaded === "object") {
      state = { day: dayKey(), dayCount: 0, hours: {}, ...loaded };
    }
  }
} catch (_) {
  // state rusak -> mulai dari nol, tidak boleh mematikan gateway
}

function persist() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), "utf8");
  } catch (_) {
    // gagal simpan tidak fatal
  }
}

function rollover() {
  const d = dayKey();
  if (state.day !== d) {
    state = { day: d, dayCount: 0, hours: {} };
    persist();
    return;
  }
  // buang bucket jam lama supaya file tidak membengkak
  const cutoff = now() - 48 * 3600 * 1000;
  for (const k of Object.keys(state.hours || {})) {
    if (new Date(k + ":00:00Z").getTime() < cutoff) delete state.hours[k];
  }
}

function hourCount() {
  const c = state.hours[hourKey()];
  return typeof c === "number" ? c : 0;
}

/** Tier warm-up berdasarkan jumlah pesan hari ini. */
function currentTier() {
  return (
    CONFIG.warmupTiers.find((t) => state.dayCount < t.max) ||
    CONFIG.warmupTiers[CONFIG.warmupTiers.length - 1]
  );
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Delay acak yang aman (ms). Lantai ikut naik saat masih warm-up. */
function safeDelay(kind) {
  const tier = currentTier();
  if (kind === "single") {
    return randomBetween(CONFIG.singleMinDelay, Math.max(CONFIG.singleMinDelay, tier.minDelay));
  }
  const min = Math.max(CONFIG.blastMinDelay, tier.minDelay);
  const max = Math.max(CONFIG.blastMaxDelay, min + 1000);
  return randomBetween(min, max);
}

/** Delay tambahan sesekali, supaya tidak terlihat seperti robot. */
function maybeFatigue(count) {
  if (count > 0 && count % CONFIG.fatigueEvery === 0) {
    return randomBetween(CONFIG.fatigueExtra, CONFIG.fatigueExtra * 2);
  }
  return 0;
}

/**
 * Cek kapasitas sebelum mengirim.
 * Return array berisi alasan pemblokiran; array kosong berarti aman.
 */
function checkQuota(planned = 1) {
  rollover();
  const tier = currentTier();
  const reasons = [];
  if (state.dayCount + planned > CONFIG.dailyCap) {
    reasons.push(`kuota harian habis (${state.dayCount}/${CONFIG.dailyCap}), reset tengah malam.`);
  }
  if (hourCount() + planned > tier.perHour) {
    reasons.push(`kuota jam ini habis (${hourCount()}/${tier.perHour}), tunggu jam berikutnya.`);
  }
  return reasons;
}

/** Catat satu pesan yang benar-benar terkirim. */
function recordSend() {
  rollover();
  state.dayCount += 1;
  const k = hourKey();
  state.hours[k] = (state.hours[k] || 0) + 1;
  persist();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tunggu jeda aman, sesekali diselingi jeda lelah. */
async function waitSafe(kind, count = 0) {
  const ms = safeDelay(kind) + maybeFatigue(count);
  if (ms > 0) await sleep(ms);
  return ms;
}

const stats = () => {
  rollover();
  const tier = currentTier();
  return {
    day: state.day,
    dayCount: state.dayCount,
    dailyCap: CONFIG.dailyCap,
    hourCount: hourCount(),
    perHourCap: tier.perHour,
    blastMinDelay: CONFIG.blastMinDelay,
    blastMaxDelay: CONFIG.blastMaxDelay,
  };
};

module.exports = { CONFIG, checkQuota, recordSend, safeDelay, waitSafe, randomBetween, stats };
