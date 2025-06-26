const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadBook, getBooks, deleteBook,downloadBookPdf } = require('../controllers/bookController');

// Multer con almacenamiento en memoria
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF.'));
  },
});

// 📤 Subir libro
router.post('/upload', upload.single('pdf'), uploadBook);

// 📚 Obtener libros
router.get('/libros', getBooks);

// ❌ Eliminar libro
router.delete('/:id', deleteBook);

// 📥 Descargar libro en PDF
router.get('/download/:id', downloadBookPdf);


module.exports = router;
