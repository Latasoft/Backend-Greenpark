require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/authRoutes'); // Ruta para usuarios
const mailRoutes = require('./src/routes/mailRoutes'); // Ruta para los correos
const bookRoutes = require('./src/routes/bookRoutes'); // Ruta para libros
const cursosRoutes = require("./src/routes/cursosRoutes"); // Ruta para cursos
const messagesRoutes = require('./src/routes/messagesRoutes');

app.use(cors({
  origin: ['http://localhost:5173', 'https://greenpark-yjxi.onrender.com', ], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Middleware para parsear JSON
app.use(express.json());

// Ruta pública para acceder a PDFs u otros archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/cursos', cursosRoutes);
app.use('/api/mensajes', messagesRoutes);



// Middleware para loguear peticiones (opcional para debug)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

// Puerto y servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

app.use((err, req, res, next) => {
  console.error("Error capturado por middleware:", err);
  res.status(500).json({ mensaje: "Error interno del servidor", error: err.message });
});


