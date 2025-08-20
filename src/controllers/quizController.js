// Usamos Firebase Admin SDK que ya está configurado en config/firebase.js
const admin = require('firebase-admin');
const { db } = require('../config/firebase');

// Guardar respuestas de un quiz
exports.guardarRespuestasQuiz = async (req, res) => {
  try {
    console.log("Body recibido:", JSON.stringify(req.body, null, 2));
    console.log("Headers:", JSON.stringify(req.headers, null, 2));

    const { cursoId, moduloIndex, respuestas, puntajeTotal, porcentaje, totalPreguntas, usuarioId: clientUserId } = req.body;
    
    // Obtener el ID de usuario del token JWT o del body como fallback
    let usuarioId = null;
    
    if (req.user && req.user.uid) {
      usuarioId = req.user.uid;
      console.log("ID de usuario obtenido del token:", usuarioId);
    } else if (clientUserId) {
      usuarioId = clientUserId;
      console.log("ID de usuario obtenido del body:", usuarioId);
    } else {
      console.log("No se encontró ID de usuario en req.user ni en req.body");
      // Usar un ID de usuario genérico para pruebas
      usuarioId = 'usuario-test-' + Date.now();
      console.log("Se usará un ID temporal:", usuarioId);
    }

    if (!cursoId || moduloIndex === undefined || !Array.isArray(respuestas)) {
      console.log("Datos incompletos:", { cursoId, moduloIndex, tieneRespuestas: Array.isArray(respuestas) });
      return res.status(400).json({ mensaje: 'Datos incompletos para guardar respuestas' });
    }

    // Estructura del documento a guardar en Firestore
    const respuestaQuizData = {
      cursoId,
      moduloIndex,
      usuarioId,
      respuestas,
      puntajeTotal,
      porcentaje,
      totalPreguntas,
      creadoEn: new Date()
    };

    // Comprobar que la conexión con Firestore está disponible
    if (!db) {
      console.error('Error: La instancia de Firestore no está disponible');
      return res.status(500).json({ 
        mensaje: 'Error de configuración en el servidor', 
        error: 'Firestore no inicializado' 
      });
    }

    // Verificar la colección
    try {
      const collectionRef = db.collection('respuestasQuiz');
      console.log('Colección de respuestasQuiz obtenida:', collectionRef.id);

      // Intentar una operación simple para verificar acceso a Firestore
      await db.collection('_test_').doc('_test_').set({ test: true });
      console.log('Verificación de acceso a Firestore exitosa');
      await db.collection('_test_').doc('_test_').delete();
    } catch (testError) {
      console.error('Error al verificar acceso a Firestore:', testError);
      return res.status(500).json({ 
        mensaje: 'Error de conexión con la base de datos', 
        error: testError.message 
      });
    }

    // Guardar en Firestore usando Firebase Admin SDK
    try {
      // Convertir los campos de fecha a objetos Firestore Timestamp para evitar errores
      respuestaQuizData.creadoEn = admin.firestore.Timestamp.fromDate(respuestaQuizData.creadoEn);
      
      // Añadir logs detallados para debug
      console.log('Intentando guardar documento en respuestasQuiz con datos:', 
        JSON.stringify({...respuestaQuizData, creadoEn: respuestaQuizData.creadoEn.toDate()}));
      
      // Realizar la escritura con un timeout para detectar problemas de conexión
      const docRef = await Promise.race([
        db.collection('respuestasQuiz').add(respuestaQuizData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout al guardar en Firestore')), 10000)
        )
      ]);
      
      console.log(`Respuestas de quiz guardadas exitosamente con ID: ${docRef.id}`);
      return res.status(201).json({ 
        mensaje: 'Respuestas guardadas correctamente', 
        id: docRef.id 
      });
    } catch (innerError) {
      console.error('Error específico al guardar en Firestore:', innerError);
      console.error('Detalles adicionales:', innerError.code, innerError.details);
      
      return res.status(500).json({ 
        mensaje: 'Error al guardar respuestas en la base de datos', 
        error: innerError.message,
        codigo: innerError.code || 'UNKNOWN'
      });
    }
  } catch (error) {
    console.error('Error general al guardar respuestas de quiz:', error);
    return res.status(500).json({ 
      mensaje: 'Error al procesar la solicitud', 
      error: error.message 
    });
  }
};

// Obtener respuestas de un usuario para un curso específico
exports.obtenerRespuestasUsuario = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const usuarioId = req.user.uid;

    if (!cursoId) {
      return res.status(400).json({ mensaje: 'ID del curso no proporcionado' });
    }

    // Consultar en Firestore usando Firebase Admin SDK
    const querySnapshot = await db.collection('respuestasQuiz')
      .where('cursoId', '==', cursoId)
      .where('usuarioId', '==', usuarioId)
      .get();
    
    const respuestas = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      respuestas.push({
        id: doc.id,
        ...data,
        creadoEn: data.creadoEn ? data.creadoEn.toDate() : null
      });
    });

    return res.status(200).json(respuestas);
  } catch (error) {
    console.error('Error al obtener respuestas de quiz:', error);
    return res.status(500).json({ mensaje: 'Error al obtener respuestas', error: error.message });
  }
};

// Obtener todas las respuestas de un curso (para administradores)
exports.obtenerTodasRespuestasCurso = async (req, res) => {
  try {
    const { cursoId } = req.params;

    if (!cursoId) {
      return res.status(400).json({ mensaje: 'ID del curso no proporcionado' });
    }

    // Consultar en Firestore usando Firebase Admin SDK
    const querySnapshot = await db.collection('respuestasQuiz')
      .where('cursoId', '==', cursoId)
      .get();
    
    const respuestas = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      respuestas.push({
        id: doc.id,
        ...data,
        creadoEn: data.creadoEn ? data.creadoEn.toDate() : null
      });
    });

    return res.status(200).json(respuestas);
  } catch (error) {
    console.error('Error al obtener respuestas de quiz:', error);
    return res.status(500).json({ mensaje: 'Error al obtener respuestas', error: error.message });
  }
};
