/**
 * scan-qr.js — tampilkan QR WhatsApp sebagai gambar PNG.
 *
 * Jalankan HANYA saat gateway utama sedang MATI, karena dua proses
 * tidak boleh memakai folder sesi yang sama.
 *
 *   1. Ctrl+C di terminal yang menjalankan `npm start`
 *   2. node scan-qr.js
 *   3. scan gambar yang terbuka dengan WhatsApp di HP
 *   4. otomatis terminate begitu tersambung
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
require("dotenv").config();

const OUT = path.join(__dirname, "wa-qr.png");
const clientId = "client"; // harus sama dengan server.js

const client = new Client({
  authStrategy: new LocalAuth({ clientId }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

let saved = false;

client.on("qr", async (qr) => {
  if (saved) return; // cukup 1x, jangan menimpa berkali-kali
  saved = true;

  await qrcode.toFile(OUT, qr, { width: 700, margin: 2 });
  console.log("");
  console.log("  QR DISIMPUL DI : " + OUT);
  console.log("  Buka file itu, scan dengan WhatsApp:");
  console.log("    WhatsApp > Perangkat Tertaut > Tautkan Perangkat");
  console.log("");

  // buka otomatis di penampil gambar bawaan Windows
  exec(`start "" "${OUT}"`, { shell: "cmd.exe" }, () => {});
});

client.on("authenticated", () => {
  console.log("  Scanner berhasil, sesi tersimpan.");
});

client.on("ready", () => {
  console.log("");
  console.log("  TERSAMBUNG. Sesi sudah tersimpan di .wwebjs_auth/session-client");
  console.log("  Sekarang jalankan:  npm start");
  console.log("");
  setTimeout(async () => {
    await client.destroy().catch(() => {});
    process.exit(0);
  }, 1000);
});

client.on("auth_failure", (msg) => {
  console.error("  GAGAL autentikasi: " + msg);
  console.error("  Hapus folder .wwebjs_auth lalu jalankan ulang.");
  process.exit(1);
});

(async () => {
  console.log("  Membuka WhatsApp, tunggu QR muncul...");
  await client.initialize();
})();
