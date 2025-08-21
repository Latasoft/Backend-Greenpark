const admin = require('firebase-admin');
const db = admin.firestore();

// Obtener datos para el diploma
exports.getDiplomaData = async (req, res) => {
  try {
    const { certificadoId } = req.params;
    
    if (!certificadoId) {
      return res.status(400).json({ mensaje: 'ID de certificado requerido' });
    }
    
    const certificadoDoc = await db.collection('certificados').doc(certificadoId).get();
    
    if (!certificadoDoc.exists) {
      return res.status(404).json({ mensaje: 'Certificado no encontrado' });
    }
    
    const certificadoData = certificadoDoc.data();
    
    // Generar la URL del diploma con los parámetros necesarios
    const diplomaUrl = `/diploma.html?nombre=${encodeURIComponent(certificadoData.nombreUsuario)}&curso=${encodeURIComponent(certificadoData.nombreCurso)}&fecha=${encodeURIComponent(new Date(certificadoData.fechaEmision.toDate()).toLocaleDateString())}&codigo=${encodeURIComponent(certificadoData.codigo)}`;
    
    return res.json({
      mensaje: 'Datos del certificado obtenidos correctamente',
      diplomaUrl,
      certificado: {
        id: certificadoDoc.id,
        ...certificadoData,
        fechaEmision: certificadoData.fechaEmision.toDate()
      }
    });
  } catch (error) {
    console.error('Error al obtener datos del diploma:', error);
    return res.status(500).json({ mensaje: 'Error al obtener datos del diploma', error: error.message });
  }
};

// Obtener certificados de un usuario
exports.getUserCertificates = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    
    if (!usuarioId) {
      return res.status(400).json({ mensaje: 'ID de usuario requerido' });
    }
    
    const certificadosSnapshot = await db.collection('certificados')
      .where('usuarioId', '==', usuarioId)
      .orderBy('fechaEmision', 'desc')
      .get();
    
    if (certificadosSnapshot.empty) {
      return res.json({
        mensaje: 'El usuario no tiene certificados',
        certificados: []
      });
    }
    
    const certificados = certificadosSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        fechaEmision: data.fechaEmision.toDate(),
        diplomaUrl: `/diploma.html?nombre=${encodeURIComponent(data.nombreUsuario)}&curso=${encodeURIComponent(data.nombreCurso)}&fecha=${encodeURIComponent(new Date(data.fechaEmision.toDate()).toLocaleDateString())}&codigo=${encodeURIComponent(data.codigo)}`
      };
    });
    
    return res.json({
      mensaje: 'Certificados obtenidos correctamente',
      certificados
    });
  } catch (error) {
    console.error('Error al obtener certificados del usuario:', error);
    return res.status(500).json({ mensaje: 'Error al obtener certificados', error: error.message });
  }
};
