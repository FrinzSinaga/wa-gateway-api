const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const config = require("../config/config.json");
const bodyParser = require("body-parser");
const { Client, LocalAuth } = require("whatsapp-web.js");
const buildRoutes = require("./routers/routes");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const colors = require("colors");
const handleMessages = require("./handlers/main.handler");
const {
  dispatchWebhook,
  buildMessagePayload,
} = require("./handlers/webhook.helper");
const apiKey = require("./middleware/apiKey");
const moment = require("moment-timezone");
const {
  opsiPuppeteer,
  ringkasBrowser,
  petunjukPerbaikan,
} = require("./helpers/browser.helper");

dotenv.config();
const app = express();
const port = process.env.APP_PORT;

app.use(cors());
app.use(bodyParser.json({ limit: "25mb" }));
app.use(apiKey);

const MAX_RETRY = 3;
const SESI_DIR = path.join(__dirname, "..", ".wwebjs_auth");

/** Client aktif. Di-reassign saat retry, jadi selalu instance terbaru. */
let client = null;

function bersihkanSesi() {
  try {
    if (fs.existsSync(SESI_DIR)) fs.rmSync(SESI_DIR, { recursive: true, force: true });
  } catch (e) {
    console.error("[boot] gagal membersihkan sesi: " + e.message);
  }
}

/**
 * Semua event handler diletakkan di sini agar bisa dipasang ulang
 * setiap kali Client dibuat ulang saat retry.
 */
function pasangListener(c) {
  c.on("qr", (qr) => {
    console.log(
      `[${moment().tz(config.timezone).format("HH:mm:ss")}] Scan the QR below : `
    );
    qrcode.generate(qr, { small: true });
  });

  c.on("ready", () => {
    console.clear();
    const consoleText = "config/console.txt";
    fs.readFile(consoleText, "utf-8", (err, data) => {
      const jam = () => moment().tz(config.timezone).format("HH:mm:ss");
      if (err) {
        console.log(`[${jam()}] Console Text not found!`.yellow);
      } else {
        console.log(data.green);
      }
      console.log(`[${jam()}] ${config.name} is Already!`.green);
    });
  });

  c.on("message", async (message) => {
    try {
      await handleMessages(client, config)(message);
    } catch (err) {
      console.error("[handler]", err.message);
    }

    if (process.env.WEBHOOK_URL) {
      dispatchWebhook(
        process.env.WEBHOOK_URL,
        buildMessagePayload(message, config)
      );
    }
  });

  c.on("message_ack", (message, ack) => {
    if (!process.env.WEBHOOK_URL) return;

    dispatchWebhook(process.env.WEBHOOK_URL, {
      event: "message.ack",
      id: message.id ? message.id._serialized : null,
      to: message.to || null,
      ack,
      timestamp: message.timestamp,
    });
  });

  c.on("auth_failure", () => {
    console.error("[boot] autentikasi gagal - sesi akan dihapus");
    bersihkanSesi();
  });
}

function buatClient() {
  const c = new Client({
    restartOnAuthFail: true,

    // Opsi ini disusun di browser.helper.js: mencari Chromium yang terpasang
    // di Windows maupun Linux, dan menaikkan batas waktu launch yang
    // defaultnya cuma 30 detik (penyebab utama gagal di VPS).
    puppeteer: opsiPuppeteer(),

    // ffmpeg hanya dipakai untuk mengirim video/audio. Di Windows path-nya
    // relatif ke file exe, di Linux nama executable-nya saja. Kalau ffmpeg
    // tidak ada, whatsapp-web.js akan tetap jalan untuk teks/gambar/PDF.
    ffmpeg: process.platform === "win32" ? "./ffmpeg.exe" : "/usr/bin/ffmpeg",

    authStrategy: new LocalAuth({
      clientId: "client",
    }),
  });

  pasangListener(c);
  return c;
}

/**
 * initialize() bisa gagal kalau WhatsApp Web sedang redirect saat
 * Puppeteer menyuntikkan kode. Itu kondisi normal di awal, bukan
 * kerusakan - cukup coba lagi.
 */
function bolehRetry(pesan) {
  return (
    pesan.includes("Execution context was destroyed") ||
    pesan.includes("frame was detached") ||
    pesan.includes("Target closed") ||
    pesan.includes("Protocol error") ||
    pesan.includes("protocolTimeout") ||
    pesan.includes("timed out") ||
    pesan.includes("Session closed")
  );
}

async function boot(percobaan = 1) {
  client = buatClient();

  console.log(
    percobaan === 1
      ? "Menghubungkan ke WhatsApp..."
      : `Mencoba lagi... (percobaan ${percobaan}/${MAX_RETRY})`
  );

  try {
    await client.initialize();
  } catch (err) {
    const pesan = (err && err.message) || String(err);

    if (bolehRetry(pesan) && percobaan < MAX_RETRY) {
      console.log(`[${moment().tz(config.timezone).format("HH:mm:ss")}] ${pesan.split("\n")[0]}`);
      console.log("[boot] halaman sedang pindah, mencoba lagi...");

      await client.destroy().catch(() => {});
      bersihkanSesi();
      await new Promise((r) => setTimeout(r, 5000 * percobaan));

      return boot(percobaan + 1);
    }

    console.error("");
    console.error(`GAGAL memulai WhatsApp: ${pesan}`);
    console.error("");
    console.error("Coba langkah ini, lalu jalankan ulang `npm start`:");
    petunjukPerbaikan().forEach((baris) => console.error(baris));
    console.error("");
    process.exit(1);
  }
}

buildRoutes(() => client).forEach(({ method, path: routePath, handler }) => {
  app[method.toLowerCase()](routePath, handler);
});

const server = app.listen(port, () => {
  const enabled = (process.env.API_KEY || "")
    .split(",")
    .some((k) => k.trim());
  const info = ringkasBrowser();

  console.log(`App listening on http://localhost:${port}`);
  console.log(`Browser        : ${info.executablePath}`);
  console.log(`Platform       : ${info.platform} | launch timeout ${info.timeout}ms`);
  console.log(`API key auth: ${enabled ? "ON" : "OFF (set API_KEY di .env)"}`);

  // Gateway yang dibiarkan tanpa API_KEY menerima request dari siapa saja
  // yang bisa mencapai portnya, jadi nagih sekali di sini.
  if (!enabled) {
    console.error("");
    console.error("PERINGATAN: API_KEY belum diisi.");
    console.error("Gateway terbuka tanpa autentikasi. Jangan expose port ini ke internet,");
    console.error("atau isi API_KEY di .env sebelum lanjut.");
    console.error("");
  }
});

// Port 5000 kadang masih dipegang proses gateway sebelumnya, atau
// proses lain (web server, project lain). Tanpa penanganan ini Node
// hanya menampilkan EADDRINUSE lalu langsung mati tanpa penjelasan.
server.on("error", async (err) => {
  if (err.code !== "EADDRINUSE") {
    console.error(`\nGagal menjalankan server: ${err.message}\n`);
    process.exit(1);
  }

  console.error(`\nPort ${port} sedang dipakai proses lain.`);
  console.error("Biasanya ini gateway yang belum ditutup dengan benar.\n");

  if (process.platform === "win32") {
    const { execSync } = require("child_process");
    const pids = new Set();
    // PATH bisa tidak memuat System32, jadi pakai path absolut.
    const sysDir = `${process.env.SystemRoot || "C:\\Windows"}\\System32`;
    try {
      const out = execSync(`"${sysDir}\\netstat.exe" -ano | "${sysDir}\\findstr.exe" :${port}`, {
        encoding: "utf8",
        shell: "C:\\Windows\\System32\\cmd.exe",
      });
      out
        .split("\n")
        .filter((l) => l.includes("LISTENING"))
        .forEach((l) => {
          const parts = l.trim().split(/\s+/);
          if (parts.length) pids.add(parts[parts.length - 1]);
        });
    } catch (_) {
      /* netstat gagal, fallback di bawah */
    }

    if (pids.size) {
      pids.forEach((pid) => console.error(`  PID ${pid} memegang port ${port}`));
      console.error("\nTutup dengan:");
      pids.forEach((pid) => console.error(`  taskkill /f /pid ${pid}`));
    } else {
      console.error("Buka Command Prompt baru, lalu:");
      console.error("  taskkill /f /im node.exe");
    }
  } else {
    // Di Linux tidak ada netstat Windows, jadi pakai tools native.
    const { execSync } = require("child_process");

    const cariPid = (perintah) => {
      try {
        return execSync(perintah, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      } catch (_) {
        return "";
      }
    };

    const ssOut = cariPid(`ss -tlnp 2>/dev/null | grep ":${port}"`);
    const pids = new Set();

    if (ssOut) {
      ssOut
        .split("\n")
        .filter(Boolean)
        .forEach((baris) => {
          const cocok = baris.match(/pid=(\d+)/);
          if (cocok) pids.add(cocok[1]);
        });
    } else {
      const lsofOut = cariPid(`lsof -ti :${port} 2>/dev/null`);
      lsofOut.split("\n").filter(Boolean).forEach((pid) => pids.add(pid.trim()));
    }

    if (pids.size) {
      pids.forEach((pid) => console.error(`  PID ${pid} memegang port ${port}`));
      console.error("\nTutup dengan:");
      pids.forEach((pid) => console.error(`  kill ${pid}`));
    } else {
      console.error("Cek manual, lalu tutup prosesnya:");
      console.error(`  lsof -i :${port}`);
      console.error(`  sudo fuser -k ${port}/tcp`);
    }
  }

  console.error("\nAtau ganti port di .env:  APP_PORT = 5001\n");
  process.exit(1);
});

boot();