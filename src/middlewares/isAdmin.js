const jwt = require('jsonwebtoken');
const db = require('../config/firebase');

const SECRET_KEY = process.env.SECRET_KEY || 'clave_secreta_segura';

const isAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token faltante o mal formado' });
    }

    const token = authHeader.split(' ')[1];

    // Para depurar:
    console.log('SECRET_KEY usada para verificar:', SECRET_KEY);
    console.log('Token recibido:', token);

    const decoded = jwt.verify(token, SECRET_KEY);

    if (decoded.rol !== 'admin') {
      return res.status(403).json({ message: 'Solo administradores' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error('Middleware isAdmin error:', err);
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
};

module.exports = isAdmin;
