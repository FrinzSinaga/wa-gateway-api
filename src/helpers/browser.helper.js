const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

/**
 * Nama binary Chromium yang dipakai distro Linux berbeda-beda. Di Windows
 * nama standarnya chrome.exe, jadi tidak perlu daftar.
 */
const NAMA_CHROMIUM_LINUX = [
  "chromium",
  "chromium-browser",
  "google-chrome-stable",
  "google-chrome",
  "chrome",
];

/**
 * Cari letak executable Chromium.
 *
 * Urutan pengecekan:
 *   1. CHROME_BIN dari .env - untuk path manual/unusual
 *   2. PUPPETEER_EXECUTABLE_PATH - nama variabel standar Puppeteer
 *   3. hasıl `which`/`where` untuk nama binary umum
 *   4. lokasi standar per-OS
 *
 * Kalau tidak ketemu, dikembalikan null supaya Puppeteer memakai
 * resolution builtin-nya (Chrome bawaan yang diunduh `npm install`).
 */
function cariExecutable() {
  const dariEnv = process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (dariEnv && fs.existsSync(dariEnv)) return dariEnv;

  const adalahWindows = process.platform === "win32";
  const perintah = adalahWindows ? "where" : "which";

  for (const nama of adalahWindows ? ["chrome.exe"] : NAMA_CHROMIUM_LINUX) {
    try {
      const out = execSync(`${perintah} ${nama}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const barisPertama = out.split("\n")[0].trim();
      if (barisPertama && fs.existsSync(barisPertama)) return barisPertama;
    } catch (_) {
      // binary tidak ada di PATH, lanjut ke kandidat berikutnya
    }
  }

  const pathStandar = adalahWindows
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
    : [
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/google-chrome",
        "/opt/google/chrome/chrome",
      ];

  const ketemu = pathStandar.find((p) => fs.existsSync(p));
  return ketemu || null;
}

/**
 * Puppeteer punya dua timeout yang sering tertukar:
 *
 *   - timeout          : menunggu proses browser connect (default 30 detik)
 *   - protocolTimeout  : menunggu balasan CDP per perintah
 *
 * Error "Timed out after 30000 ms while trying to connect to the browser"
 * berasal dari yang pertama. Di VPS yang cold start sering lebih dari 30
 * detik, jadi dinaikkan.
 */
function opsiPuppeteer() {
  const executablePath = cariExecutable();
  const timeout = Number(process.env.PUPPETEER_TIMEOUT || 120000);
  const protocolTimeout = Number(process.env.PUPPETEER_PROTOCOL_TIMEOUT || 180000);

  const opsi = {
    headless: true,
    timeout,
    protocolTimeout,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  if (executablePath) opsi.executablePath = executablePath;

  // PUPPETEER_DUMPIO=true berguna saat launch gagal: output Chromium
  // (error library, crash, sandbox) ikut tampil di terminal.
  if (process.env.PUPPETEER_DUMPIO === "true") opsi.dumpio = true;

  return opsi;
}

/** Ringkasan satu baris untuk log startup. */
function ringkasBrowser() {
  const executablePath = cariExecutable();
  const timeout = Number(process.env.PUPPETEER_TIMEOUT || 120000);
  return {
    executablePath: executablePath || "(bawaan Puppeteer)",
    timeout,
    platform: `${os.platform()} ${os.arch()}`,
  };
}

/**
 * Petunjuk perbaikan yang sesuai dengan OS. Gallah, karena pesan "taskkill"
 * tidak ada artinya di CentOS/Ubuntu.
 */
function petunjukPerbaikan() {
  const linux = process.platform !== "win32";

  if (linux) {
    return [
      "  1. Pastikan Chromium terpasang:",
      "     command -v chromium || command -v chromium-browser || command -v google-chrome",
      "     CentOS : sudo yum install -y chromium",
      "     Ubuntu : sudo apt install -y chromium-browser",
      "  2. Cek library yang hilang:",
      '     ldd "$(command -v chromium)" | grep "not found"',
      "  3. Tes Chromium tanpa gateway:",
      '     chromium --headless --no-sandbox --disable-gpu --dump-dom about:blank',
      "  4. Kalau masih gagal, lihat log detail:",
      "     PUPPETEER_DUMPIO=true npm start",
      "  5. Ganti port di .env bila 5000 sudah dipakai:",
      "     APP_PORT = 5001",
      "  6. Bersihkan sesi lalu scan ulang:",
      "     rm -rf .wwebjs_auth && npm run qr",
    ];
  }

  return [
    "  1. taskkill /f /im chrome.exe",
    "  2. rmdir /s /q .wwebjs_auth",
    "  3. npm run qr",
    "  4. Ganti port di .env bila 5000 sudah dipakai:",
    "     APP_PORT = 5001",
  ];
}

module.exports = {
  opsiPuppeteer,
  cariExecutable,
  ringkasBrowser,
  petunjukPerbaikan,
};