const admin = require('firebase-admin');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const storageBucket = 'greenpark-e3d59.appspot.com';

function loadServiceAccount() {
  const keySource = process.env.FIREBASE_ADMIN_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keySource) {
    throw new Error('FIREBASE_ADMIN_KEY o GOOGLE_APPLICATION_CREDENTIALS no está definido');
  }

  // Si parece una ruta a archivo .json
  const looksLikePath = /\.json$/.test(keySource) || keySource.startsWith('/') || keySource.startsWith('./') || keySource.startsWith('../');
  if (looksLikePath) {
    const p = path.resolve(process.cwd(), keySource);
    if (!fs.existsSync(p)) {
      throw new Error(`Ruta de credenciales no encontrada: ${p}`);
    }
    return require(p);
  }

  // Si viene en variable: intentar parsear como JSON crudo; si falla, intentar URL-decoded
  let parsed;
  try {
    parsed = JSON.parse(keySource);
  } catch (_) {
    try {
      const decoded = decodeURIComponent(keySource);
      parsed = JSON.parse(decoded);
    } catch (err) {
      throw new Error(`FIREBASE_ADMIN_KEY inválido. Debe ser JSON (crudo o URL-encoded) o una ruta .json. Detalle: ${err.message}`);
    }
  }
  return parsed;
}

const serviceAccount = loadServiceAccount();

// Arreglar saltos de línea si vinieron escapados ("\\n")
if (serviceAccount.private_key && serviceAccount.private_key.includes('\\n')) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: bucketName,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket(bucketName);

module.exports = { db, bucket, admin };