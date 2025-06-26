const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const isAdmin = require('../middlewares/isAdmin');
const authenticate = require('../middlewares/authenticate');



router.post('/register', authController.register); // registro usuario
router.post('/login', authController.login); // logueo
router.put('/approve/:userId', isAdmin, authController.approveUser); // aprobar usuario
router.delete('/users/:userId', isAdmin, authController.deleteUser); // eliminar usuario
router.get('/users', authController.listUsers); // ver lista de usuarios
router.put('/users/:userId/profile', authenticate, authController.updateUserProfile); // actualizar datos usuario

module.exports = router;
