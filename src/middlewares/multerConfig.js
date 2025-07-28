const multer = require("multer");

const storage = multer.memoryStorage();

const uploadMiddleware = multer({
  storage,
}).fields([
  { name: "imagen", maxCount: 1 },
  { name: "archivosModulo", maxCount: 10 }, // <- este nombre debe coincidir exactamente
]);

module.exports = uploadMiddleware;
