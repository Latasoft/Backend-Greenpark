const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');

const jwt = require('jsonwebtoken');
const ROLES_VALIDOS = ['admin', 'docente', 'estudiante', 'comunidad'];
const SECRET_KEY = 'clave_secreta_segura';

// regitro de usuario
exports.register = async (req, res) => {
  try {
    const { nombre, apellido, correo, fechaNacimiento, rol, password, confirmarPassword } = req.body;

    const ROLES_VALIDOS = ['admin', 'docente', 'estudiante', 'comunidad'];
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido. Los roles válidos son admin, docente, estudiante, comunidad' });
    }

    if (password !== confirmarPassword) {
      return res.status(400).json({ message: 'Las contraseñas no coinciden' });
    }

    // Verifica si ya existe un usuario con ese correo
    const existingUsers = await db.collection('users').where('correo', '==', correo).get();
    if (!existingUsers.empty) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const aprobado = rol === 'admin';

    const userRef = db.collection('users').doc();

    await userRef.set({
      nombre,
      apellido,
      correo,
      fechaNacimiento,
      rol,
      password: hashedPassword,
      aprobado,
      id: userRef.id,
    });

    res.status(201).json({
      message: aprobado
        ? 'Usuario registrado y aprobado.'
        : 'Usuario registrado, esperando aprobación del administrador.',
      userId: userRef.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
};


// loguearse
exports.login = async (req, res) => {
  try {
    const { correo, password } = req.body;
    console.log('Datos recibidos en login:', { correo, password: password ? '****' : null });

    // Buscar usuario por correo
    const userQuery = await db.collection('users').where('correo', '==', correo).get();

    if (userQuery.empty) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const userDoc = userQuery.docs[0];
    const user = userDoc.data();

    if (!user.aprobado) {
      return res.status(403).json({ message: 'Usuario no aprobado aún' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, correo: user.correo },
      SECRET_KEY,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo: user.correo,
        rol: user.rol,
        fechaNacimiento: user.fechaNacimiento || null,
        imagenPerfil: user.imagenPerfil || null
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en login' });
  }
};


// aprobar usuario
exports.approveUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // ✅ Validar que el middleware ya pasó y el usuario es admin
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: solo administradores pueden aprobar usuarios.' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const userData = userDoc.data();
    if (userData.aprobado) {
      return res.status(400).json({ message: 'El usuario ya está aprobado' });
    }

    await userRef.update({ aprobado: true });

    res.json({ message: 'Usuario aprobado correctamente' });
  } catch (error) {
    console.error('Error en approveUser:', error);
    res.status(500).json({ message: 'Error al aprobar usuario' });
  }
};

// listar usuarios
exports.listUsers = async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();

    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      delete data.password; // no mostrar contraseña
      return data;
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// eliminar usuario
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validar que el usuario autenticado exista y sea admin
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: solo administradores pueden eliminar usuarios.' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await userRef.delete();

    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error en deleteUser:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
};

// actualizar datos de perfil
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { correo, imagenPerfil } = req.body;

    // Validar autenticación (puedes adaptarlo según tu middleware)
    if (!req.user || (req.user.id !== userId && req.user.rol !== 'admin')) {
      return res.status(403).json({ message: 'No autorizado para actualizar este perfil.' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const updates = {};

    // Verificar si se quiere cambiar el correo
    if (correo) {
      const correoExistente = await db.collection('users').where('correo', '==', correo).get();
      if (!correoExistente.empty && correoExistente.docs[0].id !== userId) {
        return res.status(400).json({ message: 'El correo ya está en uso por otro usuario.' });
      }
      updates.correo = correo;
    }

    // Agregar imagen de perfil (la URL debería generarse desde el frontend o desde otro endpoint que suba a Firebase Storage)
    if (imagenPerfil) {
      updates.imagenPerfil = imagenPerfil;
    }

    await userRef.update(updates);

    res.json({ message: 'Perfil actualizado correctamente', updates });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error al actualizar perfil' });
  }
};

exports.obtenerCursosUsuario = async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const cursosSnapshot = await db.collection('cursos').get();
    const cursosInscritos = [];

    for (const cursoDoc of cursosSnapshot.docs) {
      const cursoId = cursoDoc.id;

      const usuarioCursoRef = db
        .collection('cursos')
        .doc(cursoId)
        .collection('usuariosCurso')
        .doc(usuarioId);

      const usuarioCursoDoc = await usuarioCursoRef.get();

      if (usuarioCursoDoc.exists) {
        const cursoData = cursoDoc.data();
        const progreso = usuarioCursoDoc.data().progreso ?? 0;

        // Debug: ver qué campos tiene cursoData
        console.log('cursoData:', cursoData);

        cursosInscritos.push({
          id: cursoId,
          nombre: cursoData.titulo || 'Sin título',
          duracion: cursoData.duracionHoras || 0,
          descripcion: cursoData.descripcion || '',
          progreso,
        });
      }
    }

    return res.status(200).json(cursosInscritos);
  } catch (error) {
    console.error('Error al obtener cursos del usuario:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};



