const express = require('express');
const router = express.Router();
const {
  enviarMensaje,
  obtenerMensajes,
} = require('../controllers/messagesController');

router.post('/', enviarMensaje); // Enviar mensaje
router.get('/', obtenerMensajes); // Obtener mensajes por correo

module.exports = router;