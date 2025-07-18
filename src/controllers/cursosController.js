const admin = require("firebase-admin");
const multer = require("multer");
const cloudinary = require("../utils/cloudinary");

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
exports.crearCurso = [
  uploadMiddleware,
  async (req, res) => {
    try {
      const imagenFile = req.files["imagen"]?.[0];
      if (!imagenFile) {
        return res.status(400).send("No se envió imagen del curso");
      }

      // Subir imagen a Cloudinary
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

      // Parsear campos JSON
      let herramientas = [];
      let loAprenderan = [];
      let modulos = [];

      try { herramientas = JSON.parse(req.body.herramientas || "[]"); } catch { }
      try { loAprenderan = JSON.parse(req.body.loAprenderan || "[]"); } catch { }
      try { modulos = JSON.parse(req.body.modulos || "[]"); } catch { }

      // Validar que cada módulo tenga arreglo enlaces con objetos válidos
      modulos = modulos.map((modulo) => {
        if (!Array.isArray(modulo.enlaces)) {
          modulo.enlaces = [];
        } else {
          modulo.enlaces = modulo.enlaces.filter(enlace => {
            return enlace
              && typeof enlace.nombre === "string"
              && typeof enlace.url === "string";
          });
        }
        return modulo;
      });

      // Validar dirigidoA (permitir aunque no esté en la lista)
      const opcionesValidas = ["comunidad", "estudiante", "docente"];
      let dirigidoA = (req.body.dirigidoA || "").trim().toLowerCase();
      if (!opcionesValidas.includes(dirigidoA)) {
        console.warn("Valor inválido para dirigidoA:", req.body.dirigidoA);
        dirigidoA = req.body.dirigidoA || ""; // aceptar aunque no esté validado
      }

      // Validar duración en horas
      let duracionHoras = parseInt(req.body.duracionHoras, 10);
      if (isNaN(duracionHoras) || duracionHoras < 0) {
        console.warn("Valor inválido para duracionHoras:", req.body.duracionHoras);
        duracionHoras = 0;
      }

      // Parsear fechas
      const fechaInicio = req.body.fechaInicio ? new Date(req.body.fechaInicio) : null;
      const fechaTermino = req.body.fechaTermino ? new Date(req.body.fechaTermino) : null;

      // Subir archivos de módulos
      const archivosModulo = [];

      if (req.files["archivosModulo"]) {
        for (const file of req.files["archivosModulo"]) {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: "raw",
                folder: "modulos",
                public_id: file.originalname.split(".")[0],
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });

          archivosModulo.push({
            nombre: file.originalname,
            url: result.secure_url,
          });
        }
      }

      // Crear objeto curso
      const curso = {
        titulo: req.body.titulo || "",
        imagenUrl: imagenResult.secure_url,
        herramientas,
        loAprenderan,
        duracionHoras,
        bienvenida: req.body.bienvenida || "",
        modulos,         
        archivosModulo,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        fechaInicio,
        fechaTermino,
        dirigidoA,
        estado: "pendiente"
      };


      console.log("Guardando curso:", JSON.stringify(curso, null, 2));

      const cursoRef = await db.collection("cursos").add(curso);

      res.status(201).json({
        id: cursoRef.id,
        mensaje: "Curso creado con éxito",
      });
    } catch (error) {
      console.error("Error al crear curso:", error);
      res.status(500).send("Error interno del servidor");
    }
  },
];
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

    // Contar accesos al quiz de este curso
    const accesosSnapshot = await db.collection("accesosQuiz")
      .where("cursoId", "==", cursoId)
      .get();

    const cantidadAccesosQuiz = accesosSnapshot.size;

    res.status(200).json({ 
      id: cursoDoc.id, 
      ...curso,
      cantidadAccesosQuiz  // aquí incluyes el conteo
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

    res.status(201).json({
      id: resultadoRef.id,
      ...resultado,
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


// para obtener los cursos del usuario
exports.obtenerCursosUsuario = async (req, res) => {
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
exports.actualizarCurso = [
  uploadMiddleware,
  async (req, res) => {
    const { cursoId } = req.params;

    try {
      const cursoRef = db.collection("cursos").doc(cursoId);
      const cursoSnap = await cursoRef.get();

      if (!cursoSnap.exists) {
        return res.status(404).json({ mensaje: "Curso no encontrado" });
      }

      const cursoActual = cursoSnap.data();

      // Procesar imagen (subir nueva o mantener la existente)
      const imagenFile = req.files?.["imagen"]?.[0];
      let imagenUrl = cursoActual.imagenUrl || "";

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

      // Parsear campos JSON
      let herramientas = [];
      let loAprenderan = [];
      let modulos = [];

      try { herramientas = JSON.parse(req.body.herramientas || "[]"); } catch {}
      try { loAprenderan = JSON.parse(req.body.loAprenderan || "[]"); } catch {}
      try { modulos = JSON.parse(req.body.modulos || "[]"); } catch {}

      // Validar enlaces en modulos igual que en crear
      modulos = modulos.map(modulo => {
        if (!Array.isArray(modulo.enlaces)) {
          modulo.enlaces = [];
        } else {
          modulo.enlaces = modulo.enlaces.filter(enlace =>
            enlace && typeof enlace.nombre === "string" && typeof enlace.url === "string"
          );
        }
        return modulo;
      });

      // Validar dirigidoA igual que en crear
      let dirigidoA = (req.body.dirigidoA || "").trim().toLowerCase();
      const opcionesValidas = ["comunidad", "estudiante", "docente"];
      if (!opcionesValidas.includes(dirigidoA)) {
        dirigidoA = req.body.dirigidoA || "";
      }

      // Validar duración en horas igual que en crear
      let duracionHoras = parseInt(req.body.duracionHoras, 10);
      if (isNaN(duracionHoras) || duracionHoras < 0) {
        duracionHoras = 0;
      }

      // Parsear fechas igual que en crear
      let fechaInicio = null;
      if (req.body.fechaInicio && req.body.fechaInicio.trim() !== "") {
        const dInicio = new Date(req.body.fechaInicio);
        fechaInicio = isNaN(dInicio.getTime()) ? null : dInicio;
      }

      let fechaTermino = null;
      if (req.body.fechaTermino && req.body.fechaTermino.trim() !== "") {
        const dTermino = new Date(req.body.fechaTermino);
        fechaTermino = isNaN(dTermino.getTime()) ? null : dTermino;
      }

      // Subir nuevos archivos de módulos y agregar a los existentes
      let archivosModulo = cursoActual.archivosModulo || [];

      if (req.files["archivosModulo"]) {
        for (const file of req.files["archivosModulo"]) {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: "raw",
                folder: "modulos",
                public_id: file.originalname.split(".")[0],
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            );
            stream.end(file.buffer);
          });

          archivosModulo.push({
            nombre: file.originalname,
            url: result.secure_url,
          });
        }
      }

      // Construir datos actualizados igual que en crear
      const datosActualizados = {
        titulo: req.body.titulo || "",
        imagenUrl,
        herramientas,
        loAprenderan,
        duracionHoras,
        bienvenida: req.body.bienvenida || "",
        modulos,
        archivosModulo,
        fechaInicio,
        fechaTermino,
        dirigidoA,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      };

      await cursoRef.update(datosActualizados);

      res.status(200).json({ mensaje: "Curso actualizado correctamente" });
    } catch (error) {
      console.error("Error al actualizar curso:", error);
      res.status(500).json({ mensaje: "Error al actualizar curso" });
    }
  }
];

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






