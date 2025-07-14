const { db } = require('./config/firebase'); // Ajusta la ruta según dónde esté firebase.js

async function leerUsuariosCurso(cursoId) {
  try {
    const participantesSnapshot = await db
      .collection('cursos')
      .doc(cursoId)
      .collection('usuariosCurso')
      .get();

    const participantes = participantesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log('Participantes:', participantes);
  } catch (error) {
    console.error('Error leyendo usuariosCurso:', error);
  }
}

leerUsuariosCurso('Mkuvu6yyKd4Hg2zoVfTt');
