const antiBan = require("./anti-ban");

const statusHandler = (client) => (req, res) => {
  const state = client.info ? "connected" : "disconnected";

  res.json({
    success: state === "connected",
    state,
    pushname: client.info ? client.info.pushname : null,
    wid: client.info ? client.info.wid._serialized : null,
    platform: client.info ? client.info.platform : null,
    quota: antiBan.stats(),
  });
};

module.exports = statusHandler;
