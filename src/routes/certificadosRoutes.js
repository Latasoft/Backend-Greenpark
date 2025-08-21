const express = require('express');
const router = express.Router();
const certificadosController = require('../controllers/certificadosController');
const authenticate = require('../middlewares/authenticate');

// Ruta para obtener datos de un certificado específico
router.get('/:certificadoId', authenticate, certificadosController.getDiplomaData);

// Ruta para obtener todos los certificados de un usuario
router.get('/usuario/:usuarioId', authenticate, certificadosController.getUserCertificates);

module.exports = router;
