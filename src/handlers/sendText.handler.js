const { isValidNumber, normalizeNumber } = require("./number.helper");
const { sendMessageSafe } = require("./send.helper");
const antiBan = require("./anti-ban");

const sendTextHandler = (client) => async (req, res) => {
  const { number, message } = req.body || {};

  if (!number || !isValidNumber(number)) {
    return res
      .status(400)
      .json({ success: false, error: "number wajib, format internasional tanpa + (cth: 6281234567890)" });
  }

  if (!message || typeof message !== "string") {
    return res.status(400).json({ success: false, error: "message wajib berupa string" });
  }

  if (!client.info || !client.pupPage) {
    return res.status(503).json({ success: false, error: "WhatsApp belum terhubung, scan QR dulu" });
  }

  const blocked = antiBan.checkQuota(1);
  if (blocked.length) {
    return res.status(429).json({ success: false, error: blocked.join(" ") });
  }

  try {
    await antiBan.waitSafe("single");
    const result = await sendMessageSafe(client, normalizeNumber(number), message);
    if (!result.success) {
      return res.status(500).json(result);
    }
    antiBan.recordSend();
    res.json({ ...result, quota: antiBan.stats() });
  } catch (err) {
    console.error("[send]", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = sendTextHandler;
