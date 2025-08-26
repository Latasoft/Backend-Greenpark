const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middlewares/multerConfig');
const { 
  crearCurso, 
  responderQuiz, 
  obtenerCurso, 
  obtenerCursos, 
  eliminarCurso, 
  obtenerCursosUsuario, 
  registrarAccesoQuiz, 
  publicarCurso, 
  obtenerParticipantesCurso, 
  registrarParticipanteCurso, 
  obtenerCantidadParticipantes, 
  listarUsuarios, 
  obtenerCursosPublicoPorTipo, 
  actualizarProgresoCurso, 
  getTopCursos, // Cursos destacados
  actualizarCurso, 
  eliminarArchivoModulo,
  uploadCoursePdf, // nuevo controlador
  finalizarCurso,
  enrollUser // nuevo controlador para inscribir usuario
} = require("../controllers/cursosController");

const authenticate = require("../middlewares/authenticate");

// Rutas públicas
router.get("/lista", obtenerCursos);
router.get("/publico/:tipo", obtenerCursosPublicoPorTipo);
router.get("/usuarios", listarUsuarios);
router.get("/destacados", getTopCursos);
router.post("/finalizar", authenticate, finalizarCurso);
router.post('/:cursoId/inscribir', authenticate, enrollUser);

// Rutas que requieren autenticación
router.get("/usuario-id/:usuarioId", authenticate, obtenerCursosUsuario);
router.post("/:cursoId/usuarios/:usuarioId/progreso", authenticate, actualizarProgresoCurso);
router.get("/usuario/:usuarioId/progreso", authenticate, obtenerCursosUsuario);
router.post("/:cursoId/registrarParticipante", authenticate, registrarParticipanteCurso);
router.get("/:cursoId/participantes", authenticate, obtenerParticipantesCurso);
router.get("/:cursoId/cantidadParticipantes", authenticate, obtenerCantidadParticipantes);
router.post("/:cursoId/modulos/:moduloIndex/acceso", registrarAccesoQuiz);
router.post("/:cursoId/modulos/:moduloIndex/responder", authenticate, responderQuiz);

// Subir PDF de detalle del curso (nuevo)
router.post("/:cursoId/pdf", authenticate, uploadMiddleware, uploadCoursePdf);

router.put('/:cursoId', authenticate, uploadMiddleware, actualizarCurso);
router.delete('/:cursoId/modulos/:moduloId/archivo', authenticate, eliminarArchivoModulo);
router.put("/:id/publicar", authenticate, publicarCurso);
router.post("/", uploadMiddleware, crearCurso);
router.delete("/:cursoId", eliminarCurso);

// Nueva ruta para inscribir/comenzar curso
router.post('/cursos/:cursoId/inscribir', authenticate, enrollUser);

// Obtener curso por ID (última ruta para evitar conflictos)
router.get("/:cursoId", obtenerCurso);

module.exports = router;
