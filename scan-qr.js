/**
 * scan-qr.js — tampilkan QR WhatsApp sebagai gambar PNG.
 *
 * Jalankan HANYA saat gateway utama sedang MATI, karena dua proses
 * tidak boleh memakai folder sesi yang sama.
 *
 *   1. Ctrl+C di terminal yang menjalankan `npm start`
 *   2. npm run qr
 *   3. scan gambar yang terbuka dengan WhatsApp di HP
 *   4. otomatis berhenti begitu tersambung
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
require("dotenv").config();

const OUT = path.join(__dirname, "wa-qr.png");
const clientId = "client"; // harus sama dengan server.js
const MAX_RETRY = 4;
const SESI_DIR = path.join(__dirname, ".wwebjs_auth");

let client = null;
let saved = false;
let selesai = false;

function bersihkanSesi() {
  try {
    if (fs.existsSync(SESI_DIR)) fs.rmSync(SESI_DIR, { recursive: true, force: true });
  } catch (e) {
    console.error("  Gagal membersihkan sesi: " + e.message);
  }
}

function buatClient() {
  const c = new Client({
    authStrategy: new LocalAuth({ clientId }),
    puppeteer: {
      headless: true,
      // Chromium versi baru butuh waktu lebih lama; default 30 detik
      // kadang habis sebelum WhatsApp Web selesai load.
      protocolTimeout: 180000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  c.on("qr", async (qr) => {
    if (saved || selesai) return;
    saved = true;

    try {
      await qrcode.toFile(OUT, qr, { width: 700, margin: 2 });
    } catch (e) {
      console.error("  Gagal menulis file QR: " + e.message);
      process.exit(1);
    }

    console.log("");
    console.log("  QR DISIMPUL DI : " + OUT);
    console.log("  Buka file itu, scan dengan WhatsApp:");
    console.log("    WhatsApp > Perangkat Tertaut > Tautkan Perangkat");
    console.log("");

    // Buka otomatis di penampil gambar bawaan Windows.
    // Di Linux tidak ada perintah `start`, jadi dilewati saja - QR tetap
    // ditulis ke file dan bisa dibuka manual.
    if (process.platform === "win32") {
      exec(`start "" "${OUT}"`, { shell: "cmd.exe" }, () => {});
    } else {
      console.log("  (buka file itu manual dari file manager)");
    }
  });

  c.on("authenticated", () => {
    console.log("  Scanner berhasil, sesi tersimpan.");
  });

  c.on("ready", () => {
    if (selesai) return;
    selesai = true;
    console.log("");
    console.log("  TERSAMBUNG. Sesi sudah tersimpan di .wwebjs_auth/session-client");
    console.log("  Sekarang jalankan:  npm start");
    console.log("");
    setTimeout(async () => {
      await client.destroy().catch(() => {});
      process.exit(0);
    }, 1000);
  });

  c.on("auth_failure", (msg) => {
    console.error("  GAGAL autentikasi: " + msg);
    console.error("  Hapus folder .wwebjs_auth lalu jalankan ulang.");
    process.exit(1);
  });

  c.on("disconnected", (reason) => {
    if (!selesai) console.error("  Terputus: " + reason);
  });

  return c;
}

function bolehRetry(pesan) {
  return (
    pesan.includes("Execution context was destroyed") ||
    pesan.includes("Navigating frame was detached") ||
    pesan.includes("frame was detached") ||
    pesan.includes("Target closed") ||
    pesan.includes("Protocol error") ||
    pesan.includes("protocolTimeout") ||
    pesan.includes("timed out") ||
    pesan.includes("Session closed")
  );
}

async function initializeDenganRetry(percobaan) {
  client = buatClient();

  console.log(
    percobaan === 1
      ? "  Membuka WhatsApp, tunggu QR muncul..."
      : "  Mencoba lagi... (percobaan " + percobaan + "/" + MAX_RETRY + ")"
  );

  try {
    await client.initialize();
    console.log("  WhatsApp terbuka, menunggu QR...");
  } catch (err) {
    const pesan = (err && err.message) || String(err);

    if (bolehRetry(pesan) && percobaan < MAX_RETRY) {
      console.log("  " + pesan.split("\n")[0]);
      console.log("  (halaman sedang pindah - ini normal, akan dicoba lagi)");
      console.log("");

      await client.destroy().catch(() => {});
      bersihkanSesi();
      await new Promise((r) => setTimeout(r, 4000 * percobaan));

      return initializeDenganRetry(percobaan + 1);
    }

    console.error("");
    console.error("  GAGAL setelah " + percobaan + " percobaan.");
    console.error("  " + pesan);
    console.error("");
    console.error("  Coba langkah berikut:");
    console.error("    1. Tutup semua jendela Command Prompt");
    console.error("    2. taskkill /f /im chrome.exe");
    console.error("    3. rmdir /s /q .wwebjs_auth");
    console.error("    4. npm run qr");
    console.error("");
    process.exit(1);
  }
}

initializeDenganRetry(1);