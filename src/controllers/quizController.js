// Usamos Firebase Admin SDK que ya está configurado en config/firebase.js
const admin = require('firebase-admin');
const { db } = require('../config/firebase');

// Guardar respuestas de un quiz
exports.guardarRespuestasQuiz = async (req, res) => {
  try {
    console.log("Body recibido:", JSON.stringify(req.body, null, 2));
    
    const { cursoId, moduloIndex, respuestas, puntajeTotal, porcentaje, totalPreguntas, usuarioId: clientUserId } = req.body;
    
    // Obtener el ID de usuario del token JWT o del body como fallback
    const usuarioId = req.user?.uid || clientUserId;
    
    if (!usuarioId) {
      return res.status(400).json({ 
        mensaje: 'ID de usuario no proporcionado',
        error: 'missing_user_id'
      });
    }

    console.log(`Procesando respuestas de quiz para usuario: ${usuarioId}`);

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

    console.log("Guardando respuestas en Firestore:", respuestaQuizData);

    try {
      // Guardar respuestas del quiz
      const docRef = await db.collection('respuestasQuiz').add(respuestaQuizData);
      console.log(`Respuestas guardadas con ID: ${docRef.id}`);
      
      // Determinar si el quiz fue aprobado (70% o más)
      const quizAprobado = porcentaje >= 70;
      
      // Actualizar progreso del usuario en el curso solo si el quiz fue aprobado
      const progresoActualizado = await actualizarProgresoUsuarioCurso(usuarioId, cursoId, moduloIndex, quizAprobado);
      
      return res.status(201).json({ 
        mensaje: 'Respuestas guardadas correctamente', 
        id: docRef.id,
        quizAprobado,
        progresoActualizado
      });
    } catch (dbError) {
      console.error("Error al guardar en Firestore:", dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error al guardar respuestas de quiz:', error);
    return res.status(500).json({ 
      mensaje: 'Error al guardar respuestas', 
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

// Add this function to update user course progress after saving quiz results
const actualizarProgresoUsuarioCurso = async (usuarioId, cursoId, moduloIndex, quizAprobado) => {
  try {
    console.log(`Actualizando progreso para usuario: ${usuarioId}, curso: ${cursoId}, módulo: ${moduloIndex}, aprobado: ${quizAprobado}`);
    
    // Solo actualizar progreso si el quiz fue aprobado
    if (!quizAprobado) {
      console.log("Quiz no aprobado, no se actualiza progreso");
      return false;
    }
    
    // Reference to the user-course document - using correct collection name "usuariosCurso"
    const usuariosCursoRef = db.collection('usuariosCurso')
      .where('usuarioId', '==', usuarioId)
      .where('cursoId', '==', cursoId);
      
    const usuariosCursoSnapshot = await usuariosCursoRef.get();
    
    // Get curso info to determine total module count
    const cursoRef = db.collection('cursos').doc(cursoId);
    const cursoDoc = await cursoRef.get();
    
    if (!cursoDoc.exists) {
      console.error("Curso no encontrado:", cursoId);
      return false;
    }
    
    const cursoData = cursoDoc.data();
    const totalModulos = cursoData.modulos ? cursoData.modulos.length : 0;
    
    if (totalModulos === 0) {
      console.log("El curso no tiene módulos");
      return false;
    }
    
    let usuarioCursoDoc;
    let docRef;
    
    if (usuariosCursoSnapshot.empty) {
      // Create new user-course relationship if it doesn't exist
      console.log("No existe registro de usuariosCurso, creando uno nuevo");
      
      const newUserCourse = {
        usuarioId,
        cursoId,
        modulosCompletados: quizAprobado ? [moduloIndex] : [],
        fechaInicio: new Date(),
        fechaUltimaActividad: new Date(),
        porcentajeCompletado: quizAprobado ? Math.round((1 / totalModulos) * 100) : 0,
        completado: false
      };
      
      // Using correct collection name "usuariosCurso"
      docRef = await db.collection('usuariosCurso').add(newUserCourse);
      console.log(`Creado nuevo registro usuariosCurso con ID: ${docRef.id}`);
      return true;
    } else {
      // Update existing user-course relationship
      docRef = usuariosCursoSnapshot.docs[0].ref;
      usuarioCursoDoc = usuariosCursoSnapshot.docs[0].data();
      console.log("Registro usuariosCurso existente encontrado:", usuarioCursoDoc);
      
      // Update last activity
      usuarioCursoDoc.fechaUltimaActividad = new Date();
      
      // Add module to completed modules if quiz was passed and not already there
      if (quizAprobado && !usuarioCursoDoc.modulosCompletados.includes(moduloIndex)) {
        usuarioCursoDoc.modulosCompletados.push(moduloIndex);
        console.log(`Módulo ${moduloIndex} marcado como completado`);
        
        // Calculate percentage based on completed modules
        const porcentajeCompletado = Math.round((usuarioCursoDoc.modulosCompletados.length / totalModulos) * 100);
        usuarioCursoDoc.porcentajeCompletado = porcentajeCompletado;
        
        // Check if all modules are completed
        usuarioCursoDoc.completado = usuarioCursoDoc.modulosCompletados.length === totalModulos;
        
        await docRef.update({
          modulosCompletados: usuarioCursoDoc.modulosCompletados,
          fechaUltimaActividad: new Date(),
          porcentajeCompletado: porcentajeCompletado,
          completado: usuarioCursoDoc.completado
        });
        console.log(`Registro usuariosCurso actualizado. Progreso: ${porcentajeCompletado}%`);
        return true;
      }
      
      console.log("No se actualizó el progreso (módulo ya completado o quiz no aprobado)");
      return false;
    }
  } catch (error) {
    console.error("Error al actualizar progreso de usuario en curso:", error);
    return false;
  }
};
