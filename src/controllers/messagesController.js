const { db } = require('../config/firebase'); // tu archivo de inicialización de Firebase
const { Timestamp } = require('firebase-admin/firestore');

// POST /api/mensajes
const enviarMensaje = async (req, res) => {
  try {
    const {
      from,
      fromName,
      fromRole,
      to,
      subject,
      content,
    } = req.body;

    if (!from || !to || !subject || !content || !fromName || !fromRole) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    const mensaje = {
      from,
      fromName,
      fromRole,
      to,
      subject,
      content,
      date: Timestamp.now(),
    };

    const docRef = await db.collection('messages').add(mensaje);

    res.status(201).json({ id: docRef.id, ...mensaje });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ error: 'Error interno al enviar mensaje.' });
  }
};

// GET /api/mensajes?correo=usuario@email.com
const obtenerMensajes = async (req, res) => {
  try {
    const { correo } = req.query;

    if (!correo) {
      return res.status(400).json({ error: 'El parámetro "correo" es requerido.' });
    }

    const snapshot = await db
      .collection('messages')
      .where('to', '==', correo)
      .orderBy('date', 'desc')
      .get();

    const mensajes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date.toDate(), // para formatearlo en el frontend
    }));

    res.status(200).json(mensajes);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error interno al obtener mensajes.' });
  }
};

module.exports = {
  enviarMensaje,
  obtenerMensajes,
};
