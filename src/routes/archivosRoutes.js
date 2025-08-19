const express = require('express');
const router = express.Router();
const { getArchivoFirmado } = require('../controllers/archivosController'); // O el controlador que uses

// GET /api/archivos/firma/:public_id
router.get('/firma/:public_id', getArchivoFirmado);

module.exports = router;