// middlewares/authenticate.js
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'clave_secreta_segura';

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Authorization header:", authHeader ? `${authHeader.substring(0, 20)}...` : "No authorization header");

    // Si no hay cabecera de autorización, verificamos si hay un ID de usuario en el cuerpo
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("Token no proporcionado o formato inválido, verificando usuario en body");
      
      if (req.body && req.body.usuarioId) {
        // Si hay un ID de usuario en el cuerpo, continuamos pero con un objeto de usuario simple
        console.log("Encontrado ID de usuario en el cuerpo:", req.body.usuarioId);
        req.user = { 
          uid: req.body.usuarioId, 
          id: req.body.usuarioId,
          fromBody: true 
        };
        return next();
      }
      
      return res.status(401).json({ 
        message: 'Token no proporcionado o formato inválido',
        error: 'auth_header_missing' 
      });
    }

    const token = authHeader.split(' ')[1];
    console.log("Token recibido (primeros caracteres):", token ? token.substring(0, 10) + '...' : "Token vacío");

    if (!token) {
      return res.status(401).json({ 
        message: 'Token vacío',
        error: 'empty_token' 
      });
    }

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      console.log("Token decodificado:", { id: decoded.id, rol: decoded.rol });
      
      // Aseguramos que tanto id como uid estén disponibles para mantener coherencia
      req.user = {
        ...decoded,
        id: decoded.id || decoded.uid,
        uid: decoded.id || decoded.uid
      };
      
      next();
    } catch (jwtError) {
      console.log("Error al verificar token:", jwtError.message);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token expirado, por favor inicie sesión nuevamente',
          error: 'token_expired' 
        });
      }
      
      return res.status(401).json({ 
        message: 'Token inválido: ' + jwtError.message,
        error: 'invalid_token' 
      });
    }
  } catch (error) {
    console.error("Error general en middleware de autenticación:", error);
    return res.status(500).json({ 
      message: 'Error de servidor en autenticación',
      error: 'auth_server_error' 
    });
  }
};

