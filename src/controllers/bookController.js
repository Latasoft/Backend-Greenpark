const { db } = require('../config/firebase');
const cloudinary = require('../utils/cloudinary');
const axios = require('axios');

// Subir libro (ya lo tienes)
const uploadBook = async (req, res) => {
  const { title, author, pages, description } = req.body;
  const pdfFile = req.file;

  if (!title || !author || !pages || !description || !pdfFile) {
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  }

  try {
    const streamUpload = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'books',
            public_id: `${Date.now()}-${pdfFile.originalname.replace(/\.[^/.]+$/, '')}`
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        stream.end(buffer);
      });
    };

    const result = await streamUpload(pdfFile.buffer);

    const bookData = {
      title,
      author,
      pages: Number(pages),
      description,
      pdfUrl: result.secure_url,
      pdfPublicId: result.public_id, // Necesario para eliminar el PDF de Cloudinary
      createdAt: new Date(),
    };

    const docRef = await db.collection('books').add(bookData);

    res.status(200).json({
      message: 'Libro subido correctamente.',
      id: docRef.id,
      book: bookData,
    });
  } catch (error) {
    console.error('Error al subir libro a Cloudinary:', error);
    res.status(500).json({ error: 'Error al subir el libro.' });
  }
};

// Obtener todos los libros
const getBooks = async (req, res) => {
  try {
    const snapshot = await db.collection('books').orderBy('createdAt', 'desc').get();

    const books = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json(books);
  } catch (error) {
    console.error('Error al obtener libros:', error);
    res.status(500).json({ error: 'Error al obtener los libros.' });
  }
};

// Eliminar un libro
const deleteBook = async (req, res) => {
  const { id } = req.params;

  try {
    const docRef = db.collection('books').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Libro no encontrado.' });
    }

    const data = doc.data();

    // Eliminar archivo en Cloudinary
    if (data.pdfPublicId) {
      await cloudinary.uploader.destroy(data.pdfPublicId, {
        resource_type: 'raw'
      });
    }

    // Eliminar documento de Firestore
    await docRef.delete();

    res.status(200).json({ message: 'Libro eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar libro:', error);
    res.status(500).json({ error: 'Error al eliminar el libro.' });
  }
};

// Nueva función para descargar el PDF
const downloadBookPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const docRef = db.collection('books').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Libro no encontrado.' });
    }

    const data = doc.data();

    if (!data.pdfUrl) {
      return res.status(404).json({ error: 'PDF no disponible.' });
    }

    // Hacer request a la URL del PDF en Cloudinary con stream
    const response = await axios.get(data.pdfUrl, {
      responseType: 'stream'
    });

    // Establecer headers para forzar descarga - o mostrar en el navegador
    res.setHeader('Content-Disposition', `inline; filename="${data.title}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');

    // Pipear el stream de Cloudinary al cliente
    response.data.pipe(res);

  } catch (error) {
    console.error('Error al descargar PDF:', error);
    res.status(500).json({ error: 'Error al descargar el PDF.' });
  }
};

module.exports = {
  uploadBook,
  getBooks,
  deleteBook,
  downloadBookPdf,  // <-- exporta la nueva función
};
