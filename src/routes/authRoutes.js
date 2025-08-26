const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const isAdmin = require('../middlewares/isAdmin');
const authenticate = require('../middlewares/authenticate');



router.post('/register', authController.register);
router.post('/login', authController.login);

router.get('/users', authController.listUsers);
router.delete('/users/:userId', isAdmin, authController.deleteUser);
router.put('/users/:userId/profile', authenticate, authController.updateUserProfile);
router.put('/approve/:userId', isAdmin, authController.approveUser);
router.get('/users/:userId/profile', authenticate, authController.getUserProfile);

// Al final, rutas con parámetros dinámicos menos específicos
router.get('/:usuarioId/cursos-inscritos', authController.obtenerCursosUsuario);
router.delete('/usuario/cursos-inscritos/:cursoId', authenticate, authController.eliminarCursoUsuario);




module.exports = router;
