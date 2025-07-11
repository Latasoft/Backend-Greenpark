require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const authRoutes = require('./src/routes/authRoutes');// Ruta para usuarios
const mailRoutes = require('./src/routes/mailRoutes');// Ruta para los correos
const bookRoutes = require('./src/routes/bookRoutes');// Ruta para libros
const cursosRoutes = require("./src/routes/cursosRoutes");// Ruta para cursos

app.use(cors({
  origin: '*', //['http://localhost:5173', 'https://greenpark-yjxi.onrender.com'], // la URL de tu frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // si usas cookies o autenticación basada en credenciales
}));


app.use(express.json());

// Ruta pública para acceder a los PDFs subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


app.use('/api/auth', authRoutes);// Ruta para usuarios
app.use('/api/mail', mailRoutes);// Ruta para los correos
app.use('/api/books', bookRoutes);// Ruta para libros
app.use("/api/cursos", cursosRoutes);// Ruta para cursos

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});