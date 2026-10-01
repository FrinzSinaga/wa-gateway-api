const statusHandler = require("../handlers/status.handler");
const sendTextHandler = require("../handlers/sendText.handler");
const sendMediaHandler = require("../handlers/sendMedia.handler");
const sendMessage = require("../handlers/sendMessage.handler");
const {
  blastHandler,
  blastStatusHandler,
  blastCancelHandler,
} = require("../handlers/blast.handler");

/**
 * Client WhatsApp bisa dibuat ulang saat boot gagal dan dicoba lagi.
 * Karena itu setiap handler yang butuh client menerima fungsi
 * `getClient()` dan dipanggil per-request, bukan sekali di boot.
 * Kalau tidak, request setelah retry akan memakai client lama
 * yang sudah hancur.
 */
const buildRoutes = (getClient) => [
  {
    method: `get`,
    path: `/`,
    handler: sendMessage,
  },
  {
    method: `get`,
    path: `/status`,
    handler: (req, res) => statusHandler(getClient())(req, res),
  },
  {
    method: `post`,
    path: `/send`,
    handler: (req, res) => sendTextHandler(getClient())(req, res),
  },
  {
    method: `post`,
    path: `/send-media`,
    handler: (req, res) => sendMediaHandler(getClient())(req, res),
  },
  {
    method: `post`,
    path: `/blast`,
    handler: (req, res) => blastHandler(getClient())(req, res),
  },
  {
    method: `get`,
    path: `/blast/:id`,
    handler: blastStatusHandler,
  },
  {
    method: `post`,
    path: `/blast/:id/cancel`,
    handler: blastCancelHandler,
  },
];

module.exports = buildRoutes;