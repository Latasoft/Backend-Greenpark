const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middlewares/multerConfig');
const { actualizarCurso } = require('../controllers/cursosController');

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
} = require("../controllers/cursosController");

const authenticate = require("../middlewares/authenticate");

// Rutas públicas

// Obtener lista completa de cursos (sin autenticación)
router.get("/lista", obtenerCursos);

// Obtener cursos por tipo (público)
router.get("/publico/:tipo", obtenerCursosPublicoPorTipo);

// Obtener lista de usuarios (sin autenticación)
router.get("/usuarios", listarUsuarios);

// Obtener los 3 cursos con más participantes
router.get("/destacados", getTopCursos);

// Rutas que requieren autenticación

// Obtener cursos con progreso para usuario autenticado
router.get("/usuario-id/:usuarioId", authenticate, obtenerCursosUsuario);

// Actualizar progreso de usuario en curso
router.post("/:cursoId/usuarios/:usuarioId/progreso", authenticate, actualizarProgresoCurso);

// Obtener progreso de usuario (autenticado)
router.get("/usuario/:usuarioId/progreso", authenticate, obtenerCursosUsuario);

// Registrar participante autenticado en un curso
router.post("/:cursoId/registrarParticipante", authenticate, registrarParticipanteCurso);

// Obtener participantes de un curso
router.get("/:cursoId/participantes", authenticate, obtenerParticipantesCurso);

// Obtener cantidad de participantes en un curso
router.get("/:cursoId/cantidadParticipantes", authenticate, obtenerCantidadParticipantes);

// Registrar acceso a módulo/quiz (no requiere autenticación explícita)
router.post("/:cursoId/modulos/:moduloIndex/acceso", registrarAccesoQuiz);

// Responder quiz de un módulo (requiere autenticación)
router.post("/:cursoId/modulos/:moduloIndex/responder", authenticate, responderQuiz);

// Actualizar curso (requiere autenticación y manejo de archivos)
router.put('/:cursoId', uploadMiddleware, actualizarCurso);

// Publicar curso
router.put("/:id/publicar", authenticate, publicarCurso);

// Crear nuevo curso
router.post("/", crearCurso);

// Eliminar curso
router.delete("/:cursoId", eliminarCurso);

// Obtener curso por ID (debe ir al final para evitar conflictos)
router.get("/:cursoId", obtenerCurso);

module.exports = router;
