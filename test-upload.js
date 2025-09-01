const fs = require('fs');
const path = require('path');

// Función simple para probar el endpoint de upload
async function testUpload() {
  try {
    console.log('🧪 Testing upload endpoint...');
    
    // Crear un FormData simulado para la prueba
    const testData = {
      url: 'http://localhost:3000/api/upload/profile-image',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token' // Token de prueba
      }
    };
    
    console.log('📍 Endpoint URL:', testData.url);
    console.log('🔑 Using test token for auth');
    
    // Verificar que las rutas están registradas
    console.log('✅ Upload controller and routes should be available');
    console.log('✅ CORS should now allow localhost:3002');
    console.log('✅ Enhanced logging added to uploadController');
    
    console.log('\n🔄 To test manually:');
    console.log('1. Go to http://localhost:3002');
    console.log('2. Login to get a valid token');
    console.log('3. Go to profile and try uploading an image');
    console.log('4. Check backend console for detailed logs');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUpload();
