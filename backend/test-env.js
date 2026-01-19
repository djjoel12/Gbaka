// test-env.js
require('dotenv').config();

console.log('=== TEST VARIABLES ENVIRONNEMENT ===');
console.log('PORT:', process.env.PORT);
console.log('MAPBOX_TOKEN existe ?', !!process.env.MAPBOX_TOKEN);
console.log('Longueur token:', process.env.MAPBOX_TOKEN?.length || 0);

if (process.env.MAPBOX_TOKEN) {
  console.log('✅ Token Mapbox chargé avec succès !');
} else {
  console.log('❌ ERREUR: Token Mapbox manquant !');
  console.log('👉 Ajoute MAPBOX_TOKEN dans ton .env');
}