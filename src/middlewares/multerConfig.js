const multer = require("multer");

const storage = multer.memoryStorage();

const uploadMiddleware = multer({ storage }).any();

module.exports = uploadMiddleware;

