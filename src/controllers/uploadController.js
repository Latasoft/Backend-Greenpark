const cloudinary = require('../utils/cloudinary');
const multer = require('multer');

// Configurar multer para manejar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Límite de 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Función para subir imagen de perfil
exports.uploadProfileImage = async (req, res) => {
  try {
    console.log('📁 Upload request received');
    console.log('👤 User:', req.user?.id);
    console.log('📎 File:', req.file ? 'Present' : 'Missing');
    
    if (!req.file) {
      console.log('❌ No file provided');
      return res.status(400).json({ 
        success: false,
        message: 'No se proporcionó ningún archivo' 
      });
    }

    console.log('📋 File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            transformation: [
              { width: 400, height: 400, crop: 'fill' },
              { quality: 'auto' }
            ],
            folder: 'profile_images'
          },
          (error, result) => {
            if (result) {
              console.log('✅ Cloudinary upload successful:', result.secure_url);
              resolve(result);
            } else {
              console.error('❌ Cloudinary upload failed:', error);
              reject(error);
            }
          }
        );
        stream.end(buffer);
      });
    };

    const result = await streamUpload(req.file.buffer);

    res.json({
      success: true,
      message: 'Imagen subida exitosamente',
      imageUrl: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('💥 Error al subir imagen:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al subir la imagen',
      error: error.message 
    });
  }
};

// Middleware de multer
exports.uploadMiddleware = upload.single('image');
