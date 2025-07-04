const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

const storageBucket = 'tu-nombre-de-bucket.appspot.com'; // Cambia esto por el nombre real

const encodedKey = process.env.FIREBASE_ADMIN_KEY;

if (!encodedKey) {
  throw new Error('FIREBASE_ADMIN_KEY no está definido en el archivo .env');
}

const decodedKey = decodeURIComponent(encodedKey);
const serviceAccount = JSON.parse(decodedKey);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = {
  db,
  bucket,
};