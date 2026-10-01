const dispatchWebhook = async (url, payload) => {
  if (!url) return { skipped: true };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.error("[webhook]", err.message);
    return { ok: false, error: err.message };
  }
};

const buildMessagePayload = (message, config) => ({
  event: "message.received",
  id: message.id ? message.id._serialized : null,
  from: message.from,
  author: message.author || null,
  body: message.body || null,
  type: message.type,
  timestamp: message.timestamp,
  isGroup: message.from.endsWith("@g.us"),
  hasMedia: Boolean(message.hasMedia),
  caption: message._data ? message._data.caption || null : null,
  chat_name: config ? config.name : null,
});

module.exports = { dispatchWebhook, buildMessagePayload };
