const admin = require('firebase-admin');
const dotenv = require('dotenv');
dotenv.config();

const storageBucket = 'greenpark-e3d59.appspot.com';

const encodedKey = process.env.FIREBASE_ADMIN_KEY;
if (!encodedKey) {
  throw new Error('FIREBASE_ADMIN_KEY no está definido');
}

//  Decodificamos y parseamos el JSON
const decodedKey = decodeURIComponent(encodedKey);
const serviceAccount = JSON.parse(decodedKey);

//  Arreglamos los saltos de línea en la clave privada (muy importante)
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\n/g, '\n');
}

//  Inicializamos Firebase (solo si no está ya inicializado)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = {
  db,
  bucket,
};