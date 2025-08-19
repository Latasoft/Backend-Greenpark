const cloudinary = require('../utils/cloudinary');

exports.getArchivoFirmado = async (req, res) => {
  try {
    const { public_id } = req.params;
    const url = cloudinary.v2.utils.private_download_url(public_id, 'pdf', {
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutos
    });
    res.json({ url });
  } catch (error) {
    res.status(500).json({ mensaje: "Error generando URL firmada", error: error.message });
  }
};