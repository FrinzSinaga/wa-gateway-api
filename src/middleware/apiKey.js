const crypto = require("crypto");

let cachedKeys = null;
let cachedRaw = null;

const getKeys = () => {
  const raw = process.env.API_KEY || "";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedKeys = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  return cachedKeys;
};

const hash = (value) => crypto.createHash("sha256").update(value).digest();

const extractKey = (req) => {
  const header = req.header("x-api-key");
  if (header) return header.trim();

  const auth = req.header("authorization");
  if (auth && /^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, "").trim();
  }

  return null;
};

const apiKey = (req, res, next) => {
  const keys = getKeys();
  if (keys.length === 0) return next();

  const provided = extractKey(req);
  const valid =
    provided !== null &&
    keys.some((k) => crypto.timingSafeEqual(hash(k), hash(provided)));

  if (!valid) {
    return res.status(401).json({
      success: false,
      error:
        "api key tidak valid, kirim header x-api-key: <key> atau Authorization: Bearer <key>",
    });
  }

  next();
};

module.exports = apiKey;
