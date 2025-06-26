const admin = require('firebase-admin');
const path = require('path');

// Carga la clave desde la raíz del proyecto
const serviceAccount = require(path.resolve(__dirname, '../../firebase-admin-key.json'));

// Reemplaza con el nombre de tu bucket
const storageBucket = 'tu-nombre-de-bucket.appspot.com'; // Ejemplo: 'miapp-ejemplo.appspot.com'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket, // Agrega esta línea
});

// Exportamos Firestore y Storage Bucket
const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = {
  db,
  bucket,
};
