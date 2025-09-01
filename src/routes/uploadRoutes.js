const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const authenticate = require('../middlewares/authenticate');

// Ruta para subir imagen de perfil
router.post('/profile-image', 
  authenticate, 
  uploadController.uploadMiddleware, 
  uploadController.uploadProfileImage
);

module.exports = router;
