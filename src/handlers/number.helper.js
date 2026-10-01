const isValidNumber = (number) => /^[1-9]\d{7,15}$/.test(String(number).replace(/\D/g, ""));

const normalizeNumber = (number) => String(number).replace(/\D/g, "") + "@c.us";

module.exports = { isValidNumber, normalizeNumber };
