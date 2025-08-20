const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authenticate = require('../middlewares/authenticate');
const isAdmin = require('../middlewares/isAdmin');

// Ruta para guardar respuestas de un quiz (requiere autenticación)
router.post('/respuestas', authenticate, quizController.guardarRespuestasQuiz);

// Ruta para obtener respuestas de un usuario para un curso específico
router.get('/respuestas/usuario/:cursoId', authenticate, quizController.obtenerRespuestasUsuario);

// Ruta para obtener todas las respuestas de un curso (solo admin)
router.get('/respuestas/curso/:cursoId', authenticate, isAdmin, quizController.obtenerTodasRespuestasCurso);

module.exports = router;
