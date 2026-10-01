const statusHandler = require("../handlers/status.handler");
const sendTextHandler = require("../handlers/sendText.handler");
const sendMediaHandler = require("../handlers/sendMedia.handler");
const sendMessage = require("../handlers/sendMessage.handler");
const {
  blastHandler,
  blastStatusHandler,
  blastCancelHandler,
} = require("../handlers/blast.handler");

const buildRoutes = (client) => [
  {
    method: `get`,
    path: `/`,
    handler: sendMessage,
  },
  {
    method: `get`,
    path: `/status`,
    handler: statusHandler(client),
  },
  {
    method: `post`,
    path: `/send`,
    handler: sendTextHandler(client),
  },
  {
    method: `post`,
    path: `/send-media`,
    handler: sendMediaHandler(client),
  },
  {
    method: `post`,
    path: `/blast`,
    handler: blastHandler(client),
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
