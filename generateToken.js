const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || 'clave_secreta_segura';

// Aquí defines el payload que quieras en tu token
const payload = {
  id: 'gTV5BBwzBMEZOKZrELp',   // pon el id de usuario que necesites
  rol: 'admin',
  correo: 'admin@example.com',
};

const options = {
  expiresIn: '1h',  // Expira en 1 hora, cambia si quieres
};

const token = jwt.sign(payload, SECRET_KEY, options);

console.log('Token generado:', token);
