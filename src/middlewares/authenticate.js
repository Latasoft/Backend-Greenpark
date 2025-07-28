// middlewares/authenticate.js
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET || 'clave_secreta_segura';

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Authorization header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Token no proporcionado o formato inválido");
    return res.status(401).json({ message: 'Token no proporcionado o formato inválido' });
  }

  const token = authHeader.split(' ')[1];
  console.log("Token recibido:", token);

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    console.log("Token inválido:", error.message);
    return res.status(401).json({ message: 'Token inválido' });
  }
};

