const { isValidNumber, normalizeNumber } = require("./number.helper");
const { sendMessageSafe } = require("./send.helper");
const antiBan = require("./anti-ban");

const jobs = new Map();
let running = null;
let seq = 0;

const runJob = async (client, job, numbers, message) => {
  running = job.id;

  for (let i = 0; i < numbers.length; i++) {
    if (job.cancelled) break;

    const number = numbers[i];
    const chatId = normalizeNumber(number);

    // berhenti diam-diam bila kuota habis di tengah jalan
    const blocked = antiBan.checkQuota(1);
    if (blocked.length) {
      job.stoppedReason = blocked[0];
      break;
    }

    try {
      const result = await sendMessageSafe(client, chatId, message);
      job.results.push({
        number,
        success: result.success,
        id: result.id || null,
        error: result.error || null,
      });
      if (result.success) {
        job.success++;
        antiBan.recordSend();
      } else {
        job.failed++;
      }
    } catch (err) {
      job.results.push({ number, success: false, id: null, error: err.message });
      job.failed++;
    }

    job.processed = i + 1;

    if (i < numbers.length - 1 && !job.cancelled) {
      job.lastDelay = await antiBan.waitSafe("blast", job.processed);
    }
  }

  job.done = true;
  job.finishedAt = Date.now();
  running = null;
};

const blastHandler = (client) => (req, res) => {
  const { numbers, message } = req.body || {};

  if (running) {
    return res
      .status(409)
      .json({ success: false, error: "blast lain masih berjalan, tunggu selesai" });
  }

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ success: false, error: "numbers wajib berupa array nomor" });
  }

  if (numbers.length > 500) {
    return res.status(400).json({ success: false, error: "maksimal 500 nomor per blast" });
  }

  const invalid = numbers.filter((n) => !isValidNumber(n));
  if (invalid.length > 0) {
    return res.status(400).json({ success: false, error: "format nomor tidak valid", invalid });
  }

  if (!message || typeof message !== "string") {
    return res.status(400).json({ success: false, error: "message wajib berupa string" });
  }

  if (!client.info || !client.pupPage) {
    return res.status(503).json({ success: false, error: "WhatsApp belum terhubung, scan QR dulu" });
  }

  // dedupe nomor: kirim dua kali ke orang yang sama terbaca sebagai spam
  const unique = [];
  const seen = new Set();
  for (const n of numbers) {
    const key = normalizeNumber(n);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(n);
  }

  // kuota harian / per jam
  const blocked = antiBan.checkQuota(unique.length);
  if (blocked.length) {
    return res.status(429).json({ success: false, error: blocked.join(" ") });
  }

  const id = `job_${Date.now()}_${++seq}`;

  const job = {
    id,
    total: unique.length,
    processed: 0,
    success: 0,
    failed: 0,
    done: false,
    cancelled: false,
    startedAt: Date.now(),
    finishedAt: null,
    results: [],
    lastDelay: null,
    stoppedReason: null,
  };

  jobs.set(id, job);
  runJob(client, job, unique, message);

  res.status(202).json({
    success: true,
    job_id: id,
    total: job.total,
    delayRange: `${antiBan.CONFIG.blastMinDelay}-${antiBan.CONFIG.blastMaxDelay}ms (acak)`,
    quota: antiBan.stats(),
  });
};

const blastStatusHandler = (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: "job tidak ditemukan" });
  }

  res.json({
    success: true,
    job_id: job.id,
    total: job.total,
    processed: job.processed,
    sent: job.success,
    failed: job.failed,
    done: job.done,
    cancelled: job.cancelled,
    lastDelay: job.lastDelay,
    stoppedReason: job.stoppedReason,
    quota: antiBan.stats(),
    results: job.results,
  });
};

const blastCancelHandler = (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, error: "job tidak ditemukan" });
  }

  job.cancelled = true;
  res.json({ success: true, job_id: job.id, cancelled: true });
};

module.exports = { blastHandler, blastStatusHandler, blastCancelHandler };
