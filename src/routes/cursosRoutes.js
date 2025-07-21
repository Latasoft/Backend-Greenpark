const express = require("express");
const router = express.Router();

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
  actualizarCurso,
  registrarParticipanteCurso,
  obtenerCantidadParticipantes,
  listarUsuarios,
  obtenerCursosPublicoPorTipo,
  actualizarProgresoCurso, // 🔥 Agregado
} = require("../controllers/cursosController");

const authenticate = require("../middlewares/authenticate");

// Rutas estáticas / fijas primero

// Obtener lista completa de cursos (sin autenticación)
router.get("/lista", obtenerCursos);

// Obtener cursos por tipo
router.get('/publico/:tipo', obtenerCursosPublicoPorTipo);

// Obtener cursos con progreso para usuario autenticado
router.get('/usuario-id/:usuarioId', authenticate, obtenerCursosUsuario);

// Obtener lista de usuarios (sin conflicto con :cursoId)
router.get("/usuarios", listarUsuarios);

// Actualizar progreso de usuario en curso (debe ir antes del :cursoId general)
router.post("/:cursoId/usuarios/:usuarioId/progreso", authenticate, actualizarProgresoCurso);

router.get("/usuario/:usuarioId/progreso", authenticate, obtenerCursosUsuario);

// Registrar participante autenticado en un curso
router.post("/:cursoId/registrarParticipante", authenticate, registrarParticipanteCurso);

// Obtener lista de participantes de un curso (autenticado)
router.get("/:cursoId/participantes", authenticate, obtenerParticipantesCurso);

// Obtener cantidad de participantes de un curso (autenticado)
router.get("/:cursoId/cantidadParticipantes", authenticate, obtenerCantidadParticipantes);

// Registrar acceso a un módulo/quiz
router.post("/:cursoId/modulos/:moduloIndex/acceso", registrarAccesoQuiz);

// Responder quiz de un módulo (autenticado)
router.post("/:cursoId/modulos/:moduloIndex/responder", authenticate, responderQuiz);

// Actualizar curso (autenticado)
router.put("/:cursoId", authenticate, actualizarCurso);

// Publicar curso (autenticado)
router.put("/:id/publicar", publicarCurso);

// Crear nuevo curso
router.post("/", crearCurso);

// Eliminar curso
router.delete("/:cursoId", eliminarCurso);

// Ruta genérica para obtener un curso por su ID (esta debe ir al final)
router.get("/:cursoId", obtenerCurso);

module.exports = router;
