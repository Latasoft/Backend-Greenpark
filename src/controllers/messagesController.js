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
    console.log('Obteniendo mensajes para correo:', correo);

    if (!correo) {
      return res.status(400).json({ error: 'El parámetro "correo" es requerido.' });
    }

    console.log('Consultando colección messages...');
    // Temporalmente sin orderBy para evitar el error de índice
    const snapshot = await db
      .collection('messages')
      .where('to', '==', correo)
      .get();

    console.log('Snapshot obtenido, docs count:', snapshot.docs.length);

    const mensajes = snapshot.docs.map((doc) => {
      console.log('Procesando doc:', doc.id, doc.data());
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date && data.date.toDate ? data.date.toDate() : data.date,
      };
    });

    // Ordenar manualmente por fecha (más reciente primero)
    mensajes.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    console.log('Mensajes procesados y ordenados:', mensajes.length);
    res.status(200).json(mensajes);
  } catch (error) {
    console.error('Error detallado al obtener mensajes:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Error interno al obtener mensajes.' });
  }
};

module.exports = {
  enviarMensaje,
  obtenerMensajes,
};
