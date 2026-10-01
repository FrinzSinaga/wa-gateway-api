const getChatInfo = (client, chatId) =>
  client.pupPage.evaluate(async (id) => {
    const chat = await window.WWebJS.getChat(id, { getAsModel: false });
    if (!chat) return null;
    return { id: chat.id && String(chat.id) };
  }, chatId);

const collectOutgoing = (client, remotes) =>
  client.pupPage.evaluate((remotes) => {
    const Coll = window.require("WAWebCollections");
    const models = (Coll.Msg && Coll.Msg._models) || [];
    const out = [];

    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      if (!m || !m.id || !m.id.fromMe) continue;
      const remote = m.id.remote ? String(m.id.remote) : null;
      if (remotes.indexOf(remote) === -1) continue;
      out.push({ id: String(m.id), t: m.t, ack: m.ack });
    }

    return out;
  }, remotes);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sendMessageSafe = async (client, chatId, content, options = {}) => {
  const remotes = [chatId];
  const info = await getChatInfo(client, chatId).catch(() => null);
  if (info && info.id && remotes.indexOf(info.id) === -1) remotes.push(info.id);

  const beforeIds = new Set(
    (await collectOutgoing(client, remotes).catch(() => [])).map((m) => m.id),
  );

  const sent = await client.sendMessage(chatId, content, options);

  if (sent && sent.id && typeof sent.id._serialized === "string") {
    return {
      success: true,
      id: sent.id._serialized,
      to: sent.to || chatId,
      timestamp: sent.timestamp || null,
    };
  }

  for (let i = 0; i < 12; i++) {
    const found = await collectOutgoing(client, remotes).catch(() => []);
    const fresh = found.find((m) => !beforeIds.has(m.id));
    if (fresh) {
      return {
        success: true,
        id: fresh.id,
        to: chatId,
        timestamp: fresh.t,
        ack: fresh.ack,
      };
    }
    await sleep(300);
  }

  return { success: false, error: "gagal mengirim pesan" };
};

module.exports = { sendMessageSafe };
