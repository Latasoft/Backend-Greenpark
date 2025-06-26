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
  actualizarCurso // actualizar curso
} = require("../controllers/cursosController");

const authenticate = require("../middlewares/authenticate");

router.get("/lista", obtenerCursos); // para obtener lista de cursos
router.get("/usuario/progreso", authenticate, obtenerCursosUsuario); // obtener el curso del usuario
router.put("/:id/publicar", publicarCurso); // publicar curso
router.get("/:cursoId", obtenerCurso); // obtener un curso por el id
router.post("/:cursoId/modulos/:moduloIndex/acceso", registrarAccesoQuiz); // registrar acceso
router.post("/:cursoId/modulos/:moduloIndex/responder", authenticate, responderQuiz); // responder quiz
router.post("/", crearCurso); // crear un nuevo curso
router.delete("/:cursoId", eliminarCurso); // eliminar curso
router.get("/:cursoId/participantes", obtenerParticipantesCurso); // obtener participantes
router.get("/:cursoId", obtenerCurso);
router.put('/:cursoId', authenticate, actualizarCurso); // actualizar curso
module.exports = router;
