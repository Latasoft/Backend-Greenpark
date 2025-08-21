const admin = require("firebase-admin");
const multer = require("multer");
const cloudinary = require('../cloud/cloudinaryConfig');
const db = admin.firestore();

// Función auxiliar para parsear fechas seguras
const parseFecha = (fechaStr) => {
  if (!fechaStr) return null;
  const fecha = new Date(fechaStr);
  return isNaN(fecha.getTime()) ? null : fecha;
};

// Almacenamiento en memoria para multer
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ["image/jpeg", "image/png"];
    const allowedDocTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/zip",
    ];

    if (
      file.fieldname === "imagen" &&
      allowedImageTypes.includes(file.mimetype)
    ) {
      cb(null, true);
    } else if (
      file.fieldname === "archivosModulo" &&
      allowedDocTypes.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido"), false);
    }
  },
});

// Middleware para manejar errores de multer
const uploadMiddleware = (req, res, next) => {
  upload.fields([
    { name: "imagen", maxCount: 1 },
    { name: "archivosModulo", maxCount: 10 },
  ])(req, res, (err) => {
    if (err) {
      if (err.message === "Tipo de archivo no permitido") {
        return res.status(400).json({ mensaje: err.message });
      }
      return res.status(500).json({ mensaje: "Error en la carga del archivo" });
    }
    next();
  });
};

// Controlador para crear curso
exports.crearCurso = async (req, res) => {
  try {
    // Función para convertir fecha a Timestamp Firestore
    const parseFecha = (fechaStr) => {
      if (!fechaStr) return null;
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return null;
      return admin.firestore.Timestamp.fromDate(d);
    };

    // Subir imagen si existe
    let imagenUrl;
    const imagenFile = req.files.find(f => f.fieldname === "imagen");
    if (imagenFile) {
      const imagenResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "image", folder: "cursos" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(imagenFile.buffer);
      });
      imagenUrl = imagenResult.secure_url;
    }

    // Parsear JSON
    let herramientas = [];
    let loAprenderan = [];
    let modulos = [];

    try { herramientas = JSON.parse(req.body.herramientas || "[]"); } catch {}
    try { loAprenderan = JSON.parse(req.body.loAprenderan || "[]"); } catch {}
    try { modulos = JSON.parse(req.body.modulos || "[]"); } catch {}

    // Agrupar archivos de módulos según prefijo en fieldname
    const archivosModuloNuevosPorModulo = {}; // { moduloIndex: [archivos] }

    req.files.forEach((file) => {
      if (file.fieldname === "imagen") return;

      const match = file.fieldname.match(/^archivosModulo_(\d+)$/);
      if (match) {
        const index = match[1];
        if (!archivosModuloNuevosPorModulo[index]) archivosModuloNuevosPorModulo[index] = [];
        archivosModuloNuevosPorModulo[index].push(file);
      }
    });

    // Subir archivos por módulo a Cloudinary
    const archivosModuloNuevos = [];

    for (const index in archivosModuloNuevosPorModulo) {
      for (const file of archivosModuloNuevosPorModulo[index]) {
        const result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "raw",
              folder: "modulos",
              public_id: file.originalname.split(".")[0],
              type: "authenticated", // privado
            },
            (error, uploadResult) => {
              if (error) reject(error);
              else resolve(uploadResult);
            }
          );
          stream.end(file.buffer);
        });

        archivosModuloNuevos.push({
          nombre: file.originalname,
          url: result.secure_url,
          public_id: result.public_id,   // <--- guardamos public_id
          moduloIndex: parseInt(index),
        });
      }
    }

    // Agregar archivos a cada módulo, incluyendo public_id
    archivosModuloNuevos.forEach(({ nombre, url, public_id, moduloIndex }) => {
      if (!modulos[moduloIndex].archivos) modulos[moduloIndex].archivos = [];
      modulos[moduloIndex].archivos.push({ nombre, url, public_id }); // <--- guardamos public_id aquí también
    });

    // Construir objeto curso
    const cursoNuevo = {
      titulo: typeof req.body.titulo === "string" && req.body.titulo.trim() !== "" ? req.body.titulo : "",
      imagenUrl: imagenUrl || "",
      herramientas,
      loAprenderan,
      duracionHoras: isNaN(parseInt(req.body.duracionHoras)) ? 0 : parseInt(req.body.duracionHoras),
      bienvenida: typeof req.body.bienvenida === "string" && req.body.bienvenida.trim() !== "" ? req.body.bienvenida : "",
      modulos,
      archivosModulo: archivosModuloNuevos,
      fechaInicio: parseFecha(req.body.fechaInicio),
      fechaTermino: parseFecha(req.body.fechaTermino),
      dirigidoA: req.body.dirigidoA || "",
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Guardar en Firestore
    const cursoRef = await admin.firestore().collection("cursos").add(cursoNuevo);

    return res.status(201).json({ mensaje: "Curso creado con éxito", id: cursoRef.id });
  } catch (error) {
    console.error("Error en crearCurso:", error);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};



// Para cambiar el estado de curso
exports.publicarCurso = async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("cursos").doc(id).update({ estado: "publicado" });
    res.status(200).json({ mensaje: "Curso publicado correctamente" });
  } catch (error) {
    console.error("Error al publicar curso:", error);
    res.status(500).send("Error interno del servidor");
  }
};

// Obtener el listado de cursos
exports.obtenerCursos = async (req, res) => {
  try {
    const snapshot = await db.collection("cursos").orderBy("creadoEn", "desc").get();

    // Map para hacer promesas de conteo de accesos por curso
    const cursosConConteo = await Promise.all(snapshot.docs.map(async (doc) => {
      const cursoData = doc.data();

      // Contar accesos a quiz para este curso (en la subcolección "usuariosQuiz")
      const accesosSnapshot = await db
        .collection("cursos")
        .doc(doc.id)
        .collection("usuariosQuiz")
        .get();

      const cantidadAccesosQuiz = accesosSnapshot.size;

      return {
        id: doc.id,
        ...cursoData,
        cantidadAccesosQuiz,
      };
    }));

    res.status(200).json(cursosConConteo);
  } catch (error) {
    console.error("Error al obtener cursos:", error);
    res.status(500).send("Error interno del servidor");
  }
};


// Obtener un curso por ID
exports.obtenerCurso = async (req, res) => {
  try {
    const { cursoId } = req.params;
    const cursoDoc = await db.collection("cursos").doc(cursoId).get();

    if (!cursoDoc.exists) {
      return res.status(404).json({ mensaje: "Curso no encontrado" });
    }

    const curso = cursoDoc.data();

    // No consultar subcolección, solo devolver el campo modulos si existe
    res.status(200).json({
      id: cursoDoc.id,
      ...curso,
      modulos: curso.modulos || [],
    });
  } catch (error) {
    console.error("Error al obtener curso:", error);
    res.status(500).send("Error interno del servidor");
  }
};

// Controlador para eliminar un curso por ID
exports.eliminarCurso = async (req, res) => {
  const { cursoId } = req.params;

  if (!cursoId) {
    return res.status(400).json({ mensaje: "ID del curso es requerido" });
  }

  try {
    const cursoRef = db.collection("cursos").doc(cursoId);
    const cursoDoc = await cursoRef.get();

    if (!cursoDoc.exists) {
      return res.status(404).json({ mensaje: "Curso no encontrado" });
    }

    // Eliminar el curso
    await cursoRef.delete();

    res.status(200).json({ mensaje: "Curso eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar curso:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};


// Controlador para responder quiz y guardar respuestas
exports.responderQuiz = async (req, res) => {
  const { cursoId, moduloIndex } = req.params;
  const respuestasUsuario = req.body.respuestas;

  try {
    const cursoSnap = await db.collection("cursos").doc(cursoId).get();
    if (!cursoSnap.exists) {
      return res.status(404).send("Curso no encontrado");
    }

    const curso = cursoSnap.data();
    const modulo = curso.modulos[moduloIndex];
    if (!modulo) {
      return res.status(404).send("Módulo no encontrado");
    }

    const quiz = modulo.quiz;
    if (!quiz || quiz.length === 0) {
      return res.status(400).send("Este módulo no tiene un quiz");
    }

    let puntaje = 0;
    const respuestasEvaluadas = [];

    quiz.forEach((preguntaObj, index) => {
      const respuestaUsuario = respuestasUsuario[index]?.respuestaUsuario;
      const esCorrecta = respuestaUsuario === preguntaObj.respuestaCorrecta;
      if (esCorrecta) puntaje++;

      respuestasEvaluadas.push({
        pregunta: preguntaObj.pregunta,
        respuestaUsuario,
        esCorrecta,
      });
    });

    const resultado = {
      cursoId,
      moduloIndex: parseInt(moduloIndex),
      respuestas: respuestasEvaluadas,
      puntajeTotal: puntaje,
      totalPreguntas: quiz.length,
      porcentaje: Math.round((puntaje / quiz.length) * 100),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      usuarioId: req.user.id,
    };

    // 🔁 Verificar si ya existe un intento previo (para continuar)
    const existingSnapshot = await db.collection("respuestasQuiz")
      .where("usuarioId", "==", req.user.id)
      .where("cursoId", "==", cursoId)
      .where("moduloIndex", "==", parseInt(moduloIndex))
      .limit(1)
      .get();

    let resultadoRef;

    if (!existingSnapshot.empty) {
      // 📝 Actualizar intento anterior
      const docRef = existingSnapshot.docs[0].ref;
      await docRef.update(resultado);
      resultadoRef = docRef;
    } else {
      // 🆕 Crear nuevo intento
      resultadoRef = await db.collection("respuestasQuiz").add(resultado);
    }

    // También actualizamos el registro en usuariosCurso para mantener consistencia
    try {
      // Obtener todos los resultados de este usuario para este curso
      const resultadosSnapshot = await db.collection("respuestasQuiz")
        .where("usuarioId", "==", req.user.id)
        .where("cursoId", "==", cursoId)
        .get();
      
      // Calcular el total de módulos completados
      const modulosCompletados = new Set();
      resultadosSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.porcentaje >= 70) { // Asumimos que 70% es aprobado
          modulosCompletados.add(data.moduloIndex);
        }
      });
      
      // Calcular el progreso
      const totalModulos = curso.modulos.filter(m => m.quiz && m.quiz.length > 0).length;
      const progreso = totalModulos > 0 
        ? Math.round((modulosCompletados.size / totalModulos) * 100) 
        : 0;
      
      // Actualizar en la estructura correcta
      const usuarioCursoRef = db
        .collection('cursos')
        .doc(cursoId)
        .collection('usuariosCurso')
        .doc(req.user.id);
        
      await usuarioCursoRef.set(
        { 
          progreso,
          modulosCompletados: Array.from(modulosCompletados),
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp() 
        },
        { merge: true }
      );
      
      console.log(`Progreso actualizado para usuario ${req.user.id} en curso ${cursoId}: ${progreso}%`);
    } catch (error) {
      console.error("Error al actualizar progreso en usuariosCurso:", error);
      // No fallamos la petición principal por esto
    }

    res.status(201).json({
      id: resultadoRef.id,
      ...resultado,
      progreso: resultado.porcentaje // Incluimos el progreso del módulo en la respuesta
    });
  } catch (err) {
    console.error("Error al responder quiz:", err);
    res.status(500).send("Error interno del servidor");
  }
};

exports.registrarAccesoQuiz = async (req, res) => {
  const { cursoId, moduloIndex } = req.params;

  try {
    // Referencia al doc que marca que este usuario abrió este quiz
    const accesoRef = db
      .collection("cursos")
      .doc(cursoId)
      .collection("usuariosQuiz")
      .doc(req.user.id + "_" + moduloIndex);

    const accesoDoc = await accesoRef.get();
    if (!accesoDoc.exists) {
      await accesoRef.set({
        cursoId,
        moduloIndex: parseInt(moduloIndex),
        usuarioId: req.user.id,
        accesoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.status(200).json({ mensaje: "Acceso al quiz registrado" });
  } catch (error) {
    console.error("Error al registrar acceso al quiz:", error);
    res.status(500).send("Error interno del servidor");
  }
};


// para obtener los cursos del usuario (antigua versión, mantener por compatibilidad)
exports.obtenerCursosUsuarioLegacy = async (req, res) => {
  const usuarioId = req.user.id;
  console.log("Usuario ID:", usuarioId);

  try {
    const snapshot = await db
      .collection("respuestasQuiz")
      .where("usuarioId", "==", usuarioId)
      .get();

    if (snapshot.empty) {
      console.log("No se encontraron respuestas para este usuario");
      return res.json([]);
    }

    const cursosProgreso = {};

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log("Respuesta quiz:", data);
      const cursoId = data.cursoId;

      if (!cursosProgreso[cursoId]) {
        cursosProgreso[cursoId] = {
          cursoId,
          modulosCompletados: new Set(),
          porcentajeTotal: 0,
        };
      }

      cursosProgreso[cursoId].modulosCompletados.add(data.moduloIndex);
    });

    const cursosDetalles = [];

    for (const cursoId of Object.keys(cursosProgreso)) {
      console.log("Buscando curso con ID:", cursoId);
      const cursoSnap = await db.collection("cursos").doc(cursoId).get();
      if (!cursoSnap.exists) {
        console.log("Curso no encontrado para ID:", cursoId);
        continue;
      }

      const curso = cursoSnap.data();
      const totalModulos = curso.modulos.length;
      const completados = cursosProgreso[cursoId].modulosCompletados.size;

      cursosDetalles.push({
        id: cursoId,
        titulo: curso.titulo,
        imagenUrl: curso.imagenUrl,
        porcentajeProgreso: Math.round((completados / totalModulos) * 100),
        finalizado: completados === totalModulos,
      });
    }

    res.json(cursosDetalles);
  } catch (error) {
    console.error("Error al obtener progreso del usuario:", error);
    res.status(500).json({ message: "Error al obtener cursos del usuario" });
  }
};

// para obtener los cursos del usuario (versión actual)
exports.obtenerCursosUsuario = async (req, res) => {
  const usuarioId = req.params.usuarioId || req.user.id;
  console.log("Usuario ID:", usuarioId);

  try {
    const cursosSnapshot = await db.collection('cursos').get();
    const cursosInscritos = [];

    for (const cursoDoc of cursosSnapshot.docs) {
      const cursoId = cursoDoc.id;

      const usuarioCursoRef = db
        .collection('cursos')
        .doc(cursoId)
        .collection('usuariosCurso')
        .doc(usuarioId);

      const usuarioCursoDoc = await usuarioCursoRef.get();

      if (usuarioCursoDoc.exists) {
        const cursoData = cursoDoc.data();
        const usuarioCursoData = usuarioCursoDoc.data();
        const progreso = usuarioCursoData.progreso ?? 0;

        cursosInscritos.push({
          id: cursoId,
          titulo: cursoData.titulo || 'Sin título',
          descripcion: cursoData.descripcion || '',
          imagenUrl: cursoData.imagenUrl || '',
          duracionHoras: cursoData.duracionHoras || 0,
          porcentajeProgreso: progreso,
          finalizado: usuarioCursoData.completado || false
        });
      }
    }
    
    console.log(`Se encontraron ${cursosInscritos.length} cursos para el usuario ${usuarioId}`);
    return res.status(200).json(cursosInscritos);
  } catch (error) {
    console.error('Error al obtener cursos del usuario:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// obtener participantes de un curso
exports.obtenerParticipantesCurso = async (req, res) => {
  const { cursoId } = req.params;

  try {
    const snapshot = await db
      .collection("cursos")
      .doc(cursoId)
      .collection("usuariosQuiz")
      .get();

    if (snapshot.empty) {
      return res.status(200).json([]);
    }

    const participantes = snapshot.docs.map(doc => doc.data());

    res.status(200).json(participantes);
  } catch (error) {
    console.error("Error al obtener participantes:", error);
    res.status(500).json({ mensaje: "Error al obtener participantes" });
  }
};



// para obtener el progreso del usuario en el quiz
exports.obtenerProgresoModulo = async (req, res) => {
  const { cursoId, moduloIndex } = req.params;
  const usuarioId = req.user.id;

  try {
    const snapshot = await db.collection("respuestasQuiz")
      .where("usuarioId", "==", usuarioId)
      .where("cursoId", "==", cursoId)
      .where("moduloIndex", "==", parseInt(moduloIndex))
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: "Sin progreso guardado" });
    }

    const progreso = snapshot.docs[0].data();
    res.json(progreso);
  } catch (error) {
    console.error("Error al obtener progreso del módulo:", error);
    res.status(500).json({ message: "Error al obtener progreso" });
  }
};

// 🔄 Controlador para actualizar un curso
exports.actualizarCurso = async (req, res) => {
  try {
    const { cursoId } = req.params;
    if (!cursoId || typeof cursoId !== "string") {
      return res.status(400).json({ mensaje: "ID de curso inválido" });
    }

    const parseFecha = (fechaStr) => {
      if (!fechaStr) return null;
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return null;
      return admin.firestore.Timestamp.fromDate(d);
    };

    // Subir imagen principal si existe
    let imagenUrl;
    const imagenFile = req.files.find((f) => f.fieldname === "imagen");
    if (imagenFile) {
      const imagenResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "image", folder: "cursos" },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(imagenFile.buffer);
      });
      imagenUrl = imagenResult.secure_url;
    }

    // Parsear arrays enviados como JSON
    let herramientas = [];
    let loAprenderan = [];
    let modulos = [];

    try { herramientas = JSON.parse(req.body.herramientas || "[]"); } catch {}
    try { loAprenderan = JSON.parse(req.body.loAprenderan || "[]"); } catch {}
    try { modulos = JSON.parse(req.body.modulos || "[]"); } catch {}

    // Agrupar archivos nuevos por módulo
    const archivosModuloNuevosPorModulo = {};
    req.files.forEach((file) => {
      if (file.fieldname === "imagen") return;
      const match = file.fieldname.match(/^archivosModulo_(\d+)$/);
      if (match) {
        const index = match[1];
        if (!archivosModuloNuevosPorModulo[index]) archivosModuloNuevosPorModulo[index] = [];
        archivosModuloNuevosPorModulo[index].push(file);
      }
    });

    const limpiarPublicId = (nombreOriginal) => {
      return nombreOriginal
        .replace(/\.[^/.]+$/, "")
        .replace(/\s+/g, "_")
        .replace(/[^\w\-]/g, "");
    };

    const archivosModuloNuevos = [];

    for (const index in archivosModuloNuevosPorModulo) {
      for (const file of archivosModuloNuevosPorModulo[index]) {
        const esPDF = file.mimetype === "application/pdf" &&
          file.originalname.toLowerCase().endsWith(".pdf");
        if (!esPDF) {
          console.warn(`Archivo omitido (no es PDF): ${file.originalname}`);
          continue;
        }

        try {
          const publicIdLimpio = `cursos/${cursoId}/modulos/${limpiarPublicId(file.originalname)}`;

          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { resource_type: "raw", public_id: publicIdLimpio },
              (error, uploadResult) => error ? reject(error) : resolve(uploadResult)
            );
            stream.end(file.buffer);
          });

          archivosModuloNuevos.push({
            nombre: file.originalname,
            url: result.secure_url,
            public_id: result.public_id,
            moduloIndex: parseInt(index),
          });
        } catch (err) {
          console.error(`Error subiendo archivo ${file.originalname}:`, err);
        }
      }
    }

    // Añadir PDFs nuevos con public_id a modulos
    archivosModuloNuevos.forEach(({ nombre, url, public_id, moduloIndex }) => {
      if (!modulos[moduloIndex].archivos) modulos[moduloIndex].archivos = [];
      modulos[moduloIndex].archivos.push({
        nombre,
        url,
        public_id, // guardamos el public_id para poder borrar después
      });
    });

    // Obtener curso actual
    const cursoRef = admin.firestore().collection("cursos").doc(cursoId);
    const cursoSnapshot = await cursoRef.get();

    if (!cursoSnapshot.exists) {
      return res.status(404).json({ mensaje: "Curso no encontrado" });
    }

    const cursoActual = cursoSnapshot.data();

    // Preparar actualización
    const cursoActualizado = {
      titulo: typeof req.body.titulo === "string" && req.body.titulo.trim() !== ""
        ? req.body.titulo
        : cursoActual.titulo || "",
      imagenUrl: imagenUrl || cursoActual.imagenUrl || "",
      herramientas,
      loAprenderan,
      duracionHoras: isNaN(parseInt(req.body.duracionHoras))
        ? 0
        : parseInt(req.body.duracionHoras),
      bienvenida: typeof req.body.bienvenida === "string" && req.body.bienvenida.trim() !== ""
        ? req.body.bienvenida
        : cursoActual.bienvenida || "",
      modulos,
      archivosModulo: Array.isArray(cursoActual.archivosModulo)
        ? [...cursoActual.archivosModulo, ...archivosModuloNuevos]
        : archivosModuloNuevos,
      fechaInicio: parseFecha(req.body.fechaInicio),
      fechaTermino: parseFecha(req.body.fechaTermino),
      dirigidoA: req.body.dirigidoA || cursoActual.dirigidoA || "",
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };

    await cursoRef.update(cursoActualizado);

    return res.status(200).json({ mensaje: "Curso actualizado con éxito" });
  } catch (error) {
    console.error("Error en actualizarCurso:", error);
    return res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};



exports.registrarParticipanteCurso = async (req, res) => {
  const { cursoId } = req.params;
  const usuarioId = req.user.id;

  if (!cursoId) {
    return res.status(400).json({ mensaje: "ID de curso es requerido" });
  }

  try {
    const participanteRef = db
      .collection("cursos")
      .doc(cursoId)
      .collection("usuariosCurso")
      .doc(usuarioId);

    const participanteDoc = await participanteRef.get();

    if (participanteDoc.exists) {
      return res.status(200).json({ mensaje: "Participante ya registrado" });
    }

    await participanteRef.set({
      usuarioId,
      registradoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ mensaje: "Participante registrado con éxito" });
  } catch (error) {
    console.error("Error al registrar participante:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

exports.obtenerCantidadParticipantes = async (req, res) => {
  const { cursoId } = req.params;

  if (!cursoId) {
    return res.status(400).json({ mensaje: "ID de curso es requerido" });
  }

  try {
    const participantesSnapshot = await db
      .collection("cursos")
      .doc(cursoId)
      .collection("usuariosCurso")
      .get();

    console.log("Participantes IDs:", participantesSnapshot.docs.map(doc => doc.id));

    const cantidad = participantesSnapshot.size; // número de documentos

    res.status(200).json({ cursoId, cantidadParticipantes: cantidad });
  } catch (error) {
    console.error("Error al obtener cantidad de participantes:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

exports.obtenerCantidadParticipantes = async (req, res) => {
  const { cursoId } = req.params;

  if (!cursoId) {
    return res.status(400).json({ mensaje: "ID de curso es requerido" });
  }

  try {
    const participantesSnapshot = await db
      .collection("cursos")
      .doc(cursoId)
      .collection("usuariosCurso")
      .get();

    console.log("Participantes IDs:", participantesSnapshot.docs.map(doc => doc.id));

    const cantidad = participantesSnapshot.size; // número de documentos

    res.status(200).json({ cursoId, cantidadParticipantes: cantidad });
  } catch (error) {
    console.error("Error al obtener cantidad de participantes:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

exports.obtenerParticipantesCurso = async (req, res) => {
  const { cursoId } = req.params;

  if (!cursoId) {
    return res.status(400).json({ mensaje: "ID de curso es requerido" });
  }

  try {
    const participantesSnapshot = await db
      .collection("cursos")
      .doc(cursoId)
      .collection("usuariosCurso")
      .get();

    if (participantesSnapshot.empty) {
      return res.status(200).json({ participantes: [] });
    }

    // Para cada participante, consulta su info en "users"
    const participantes = await Promise.all(
      participantesSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const usuarioId = data.usuarioId;

        // Aquí busca en la colección users por usuarioId
        const usuarioDoc = await db.collection("users").doc(usuarioId).get();
        const usuarioData = usuarioDoc.exists ? usuarioDoc.data() : {};

        return {
          id: doc.id,
          nombre: usuarioData.nombre || "Sin nombre",
          correo: usuarioData.correo || "Sin correo",
          registradoEn: data.registradoEn?.toDate?.() || null,
        };
      })
    );

    res.status(200).json({ participantes });
  } catch (error) {
    console.error("Error al obtener participantes del curso:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

exports.listarUsuarios = async (req, res) => {
  try {
    const usuariosSnapshot = await db.collection("users").get();
    const usuarios = usuariosSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json({ usuarios });
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

//cursos por tipo
exports.obtenerCursosPublicoPorTipo = async (req, res) => {
  const { tipo } = req.params;

  if (!["docente", "estudiante", "comunidad"].includes(tipo)) {
    return res.status(400).json({ mensaje: "Tipo inválido" });
  }

  try {
    const snapshot = await db
      .collection("cursos")
      .where("estado", "==", "publicado")  // <-- cambiar aquí
      .where("dirigidoA", "==", tipo)
      .get();

    const cursos = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(cursos);
  } catch (error) {
    console.error("Error al obtener cursos por tipo:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Esta función ha sido movida y actualizada arriba

exports.actualizarProgresoCurso = async (req, res) => {
  const { cursoId, usuarioId } = req.params;
  const { progreso } = req.body;

  console.log("Actualizar progreso - Params:", { cursoId, usuarioId });
  console.log("Actualizar progreso - Body:", req.body);

  if (typeof progreso !== 'number' || progreso < 0 || progreso > 100) {
    return res.status(400).json({ mensaje: 'Progreso inválido. Debe ser un número entre 0 y 100.' });
  }

  try {
    const usuarioCursoRef = db
      .collection('cursos')
      .doc(cursoId)
      .collection('usuariosCurso')
      .doc(usuarioId);

    await usuarioCursoRef.set(
      { progreso, actualizadoEn: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    const updatedDoc = await usuarioCursoRef.get();
    console.log("Documento actualizado:", updatedDoc.data());

    return res.status(200).json({ mensaje: 'Progreso actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar progreso:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

exports.getTopCursos = async (req, res) => {
  try {
    const cursosSnapshot = await db.collection("cursos").get();

    const cursosConConteo = await Promise.all(
      cursosSnapshot.docs.map(async (cursoDoc) => {
        const cursoData = cursoDoc.data();
        const usuariosSnapshot = await db
          .collection("cursos")
          .doc(cursoDoc.id)
          .collection("usuariosCurso")
          .get();

        return {
          id: cursoDoc.id,
          ...cursoData,
          participantes: usuariosSnapshot.size,
        };
      })
    );

    const topCursos = cursosConConteo
      .sort((a, b) => b.participantes - a.participantes)
      .slice(0, 10);

    res.status(200).json({ cursos: topCursos });
  } catch (error) {
    console.error("Error al obtener cursos destacados:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

exports.eliminarArchivoModulo = async (req, res) => {
  const { cursoId, moduloIndex } = req.params; // O lo que uses para pasar índice
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ mensaje: "Falta URL del archivo a eliminar" });
  }

  const moduloIndexNum = parseInt(moduloIndex, 10);
  if (isNaN(moduloIndexNum)) {
    return res.status(400).json({ mensaje: "Índice de módulo inválido" });
  }

  try {
    const cursoRef = db.collection("cursos").doc(cursoId);
    const cursoSnap = await cursoRef.get();

    if (!cursoSnap.exists) {
      return res.status(404).json({ mensaje: "Curso no encontrado" });
    }

    const cursoData = cursoSnap.data();

    if (!cursoData.modulos || !Array.isArray(cursoData.modulos)) {
      return res.status(404).json({ mensaje: "El curso no tiene módulos" });
    }

    if (moduloIndexNum < 0 || moduloIndexNum >= cursoData.modulos.length) {
      return res.status(400).json({ mensaje: "Índice de módulo fuera de rango" });
    }

    const modulo = cursoData.modulos[moduloIndexNum];
    const archivoExistia = (modulo.archivos || []).some(archivo => archivo.url === url);
    if (!archivoExistia) {
      return res.status(404).json({ mensaje: "Archivo no encontrado en el módulo" });
    }

    // Filtrar archivo a eliminar
    modulo.archivos = (modulo.archivos || []).filter(archivo => archivo.url !== url);

    // Actualizar módulo en array
    const modulosActualizados = [...cursoData.modulos];
    modulosActualizados[moduloIndexNum] = modulo;

    // Actualizar en Firestore
    await cursoRef.update({ modulos: modulosActualizados });

    res.status(200).json({ mensaje: "Archivo eliminado correctamente" });
  } catch (error) {
    console.error("Error eliminando archivo módulo:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};



exports.uploadCoursePdf = async (req, res) => {
  const { cursoId } = req.params;
  const { pdfFile } = req.body;

  if (!pdfFile) {
    return res.status(400).json({ mensaje: "Falta el archivo PDF" });
  }

  try {
    const cursoRef = db.collection("cursos").doc(cursoId);
    const cursoSnap = await cursoRef.get();

    if (!cursoSnap.exists) {
      return res.status(404).json({ mensaje: "Curso no encontrado" });
    }

    // Aquí puedes manejar la lógica para subir el PDF a tu almacenamiento
    // y luego actualizar la referencia en Firestore

    res.status(200).json({ mensaje: "PDF subido correctamente" });
  } catch (error) {
    console.error("Error subiendo PDF del curso:", error);
    res.status(500).json({ mensaje: "Error interno del servidor" });
  }
};

// Add this new function to handle course completion
exports.finalizarCurso = async (req, res) => {
  try {
    console.log('Finalizando curso - Request body:', req.body);
    const { cursoId, usuarioId } = req.body;
    
    if (!cursoId || !usuarioId) {
      console.log('Error: Faltan parámetros requeridos:', { cursoId, usuarioId });
      return res.status(400).json({ 
        mensaje: 'Se requieren cursoId y usuarioId',
        error: 'missing_parameters'
      });
    }
    
    // Get curso info
    const cursoRef = db.collection('cursos').doc(cursoId);
    const cursoDoc = await cursoRef.get();
    
    if (!cursoDoc.exists) {
      console.log(`Error: Curso con ID ${cursoId} no encontrado`);
      return res.status(404).json({ mensaje: 'Curso no encontrado' });
    }
    
    const cursoData = cursoDoc.data();
    console.log(`Curso encontrado: ${cursoData.titulo || 'Sin título'}`);
    
    // Get user course progress
    const usuarioCursoRef = db
      .collection('cursos')
      .doc(cursoId)
      .collection('usuariosCurso')
      .doc(usuarioId);
      
    console.log(`Buscando progreso en: cursos/${cursoId}/usuariosCurso/${usuarioId}`);
    const usuarioCursoDoc = await usuarioCursoRef.get();
    
    let usuarioCursoData = {};
    
    // Si no existe el documento de progreso, lo creamos con progreso 100%
    if (!usuarioCursoDoc.exists) {
      console.log(`No se encontró registro de progreso para usuario ${usuarioId} en curso ${cursoId}. Creando uno nuevo.`);
      
      // Para propósitos de depuración, generamos el certificado de todas formas
      await usuarioCursoRef.set({
        progreso: 100,
        completado: true,
        fechaCompletado: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Documento de progreso creado con progreso 100%');
      
      // Obtener los datos recién creados
      usuarioCursoData = {
        progreso: 100,
        completado: true,
        fechaCompletado: new Date()
      };
    } else {
      usuarioCursoData = usuarioCursoDoc.data();
      console.log('Documento de progreso encontrado:', usuarioCursoData);
      
      // Si el progreso no es 100%, lo actualizamos
      if (!usuarioCursoData.progreso || usuarioCursoData.progreso < 100) {
        console.log(`Advertencia: El progreso actual es del ${usuarioCursoData.progreso || 0}%, pero se generará el certificado de todas formas.`);
        
        // Actualizar a 100% para generar el certificado
        await usuarioCursoRef.set({
          progreso: 100,
          completado: true,
          fechaCompletado: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        console.log('Progreso actualizado a 100%');
        
        // Actualizar los datos locales
        usuarioCursoData = {
          ...usuarioCursoData,
          progreso: 100,
          completado: true,
          fechaCompletado: new Date()
        };
      }
    }
    
    // Función para buscar el nombre completo de un usuario
    const buscarNombreUsuario = async (id) => {
      console.log(`Buscando datos para el usuario con ID: ${id}`);
      
      // Intentar en la colección 'users' primero
      try {
        const userDoc = await db.collection('users').doc(id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log('Usuario encontrado en colección "users":', userData);
          // Verificar diferentes campos posibles para nombre y apellido
          const nombre = userData.nombre || userData.name || userData.firstName || '';
          const apellido = userData.apellido || userData.lastname || userData.lastName || '';
          return `${nombre} ${apellido}`.trim();
        }
      } catch (err) {
        console.log('Error al buscar en colección "users":', err);
      }
      
      // Intentar en la colección 'usuarios' como respaldo
      try {
        const usuarioDoc = await db.collection('usuarios').doc(id).get();
        if (usuarioDoc.exists) {
          const userData = usuarioDoc.data();
          console.log('Usuario encontrado en colección "usuarios":', userData);
          // Verificar diferentes campos posibles para nombre y apellido
          const nombre = userData.nombre || userData.name || userData.firstName || '';
          const apellido = userData.apellido || userData.lastname || userData.lastName || '';
          return `${nombre} ${apellido}`.trim();
        }
      } catch (err) {
        console.log('Error al buscar en colección "usuarios":', err);
      }
      
      return '';
    };
    
    // Buscar nombre de usuario
    let nombreCompleto = '';
    
    // Si usuarioCurso tiene información sobre el usuario
    if (usuarioCursoData && usuarioCursoData.nombreUsuario) {
      nombreCompleto = usuarioCursoData.nombreUsuario;
      console.log(`Nombre encontrado en usuariosCurso: ${nombreCompleto}`);
    }
    
    // Si no tenemos nombre, buscar en las colecciones de usuarios
    if (!nombreCompleto) {
      nombreCompleto = await buscarNombreUsuario(usuarioId);
      console.log(`Nombre obtenido tras búsqueda: ${nombreCompleto || 'No encontrado'}`);
    }
    
    // Si aún no tenemos nombre, buscar en otras fuentes
    if (!nombreCompleto) {
      // Buscar en respuestasQuiz
      try {
        const respuestasSnapshot = await db.collection("respuestasQuiz")
          .where("usuarioId", "==", usuarioId)
          .limit(1)
          .get();
          
        if (!respuestasSnapshot.empty && respuestasSnapshot.docs[0].data().nombreUsuario) {
          nombreCompleto = respuestasSnapshot.docs[0].data().nombreUsuario;
          console.log(`Nombre encontrado en respuestasQuiz: ${nombreCompleto}`);
        }
      } catch (err) {
        console.log("Error al buscar nombre de usuario en respuestasQuiz", err);
      }
    }
    
    // Si aún no hay nombre, usar un placeholder
    if (!nombreCompleto) {
      nombreCompleto = `Usuario ${usuarioId.substring(0, 6)}`;
      console.log(`Usando nombre por defecto: ${nombreCompleto}`);
    }
    
    // Verificar si ya existe un certificado para este usuario y curso
    console.log(`Buscando certificados existentes para usuarioId=${usuarioId} y cursoId=${cursoId}`);
    const certificadosExistentes = await db.collection('certificados')
      .where('usuarioId', '==', usuarioId)
      .where('cursoId', '==', cursoId)
      .get();
    
    let certificadoRef;
    let certificadoData;
    
    if (!certificadosExistentes.empty) {
      // Si ya existe un certificado, lo reutilizamos
      console.log('Ya existe un certificado para este usuario y curso');
      certificadoRef = certificadosExistentes.docs[0].ref;
      certificadoData = certificadosExistentes.docs[0].data();
      
      // Actualizar el nombre del usuario si es necesario
      if (certificadoData.nombreUsuario !== nombreCompleto) {
        console.log(`Actualizando nombre en certificado de "${certificadoData.nombreUsuario}" a "${nombreCompleto}"`);
        await certificadoRef.update({ nombreUsuario: nombreCompleto });
        certificadoData.nombreUsuario = nombreCompleto;
      }
    } else {
      // Generar certificado nuevo
      certificadoData = {
        usuarioId,
        nombreUsuario: nombreCompleto,
        cursoId,
        nombreCurso: cursoData.titulo || 'Curso sin título',
        fechaEmision: new Date(),
        codigo: `CERT-${cursoId.substring(0, 4)}-${usuarioId.substring(0, 4)}-${Date.now().toString(36)}`
      };
      
      console.log('Generando nuevo certificado:', certificadoData);
      certificadoRef = await db.collection('certificados').add(certificadoData);
      console.log(`Certificado creado con ID: ${certificadoRef.id}`);
    }
    
    // Generar URL del diploma sin fecha (se genera en la plantilla)
    const diplomaUrl = `/diploma.html?nombre=${encodeURIComponent(nombreCompleto)}&curso=${encodeURIComponent(cursoData.titulo || 'Curso sin título')}&codigo=${encodeURIComponent(certificadoData.codigo)}`;
    
    console.log(`URL del diploma generada: ${diplomaUrl}`);
    
    return res.status(200).json({
      mensaje: 'Curso finalizado exitosamente',
      porcentajeCompletado: 100,
      fechaCompletado: new Date(),
      certificado: {
        id: certificadoRef.id,
        ...certificadoData
      },
      diplomaUrl
    });
  } catch (error) {
    console.error('Error al finalizar curso:', error);
    
    // Proporcionar más detalles sobre el error para ayudar con la depuración
    let detallesError = '';
    if (error.code) detallesError += `Código: ${error.code}. `;
    if (error.details) detallesError += `Detalles: ${error.details}. `;
    
    return res.status(500).json({ 
      mensaje: 'Error al finalizar curso', 
      error: error.message,
      detalles: detallesError || 'Sin detalles adicionales',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};
