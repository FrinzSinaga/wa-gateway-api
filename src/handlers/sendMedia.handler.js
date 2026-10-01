const { MessageMedia } = require("whatsapp-web.js");
const { isValidNumber, normalizeNumber } = require("./number.helper");
const { sendMessageSafe } = require("./send.helper");
const antiBan = require("./anti-ban");

const sendMediaHandler = (client) => async (req, res) => {
  const { number, file, caption, filename } = req.body || {};

  if (!number || !isValidNumber(number)) {
    return res
      .status(400)
      .json({ success: false, error: "number wajib, format internasional tanpa + (cth: 6281234567890)" });
  }

  if (!file || typeof file !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "file wajib, format data URI (data:image/png;base64,....)" });
  }

  if (!client.info || !client.pupPage) {
    return res.status(503).json({ success: false, error: "WhatsApp belum terhubung, scan QR dulu" });
  }

  const match = /^data:(.+?);base64,(.+)$/.exec(file);
  if (!match) {
    return res
      .status(400)
      .json({ success: false, error: "file harus data URI base64, contoh: data:image/png;base64,..." });
  }

  // media ikut consume kuota: pesan foto dihitung sama oleh WhatsApp
  const blocked = antiBan.checkQuota(1);
  if (blocked.length) {
    return res.status(429).json({ success: false, error: blocked.join(" ") });
  }

  try {
    await antiBan.waitSafe("single");
    const media = new MessageMedia(match[1], match[2], filename || undefined);
    const result = await sendMessageSafe(client, normalizeNumber(number), media, {
      caption: caption || undefined,
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    antiBan.recordSend();
    res.json({ ...result, quota: antiBan.stats() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = sendMediaHandler;
