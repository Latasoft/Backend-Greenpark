const multer = require("multer");
const storage = multer.memoryStorage();

const upload = multer({ storage });

const uploadMiddleware = (req, res, next) => {
  // Acepta cualquier campo de archivo
  upload.any()(req, res, next);
};

module.exports = uploadMiddleware;