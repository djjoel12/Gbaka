import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

// Initialiser Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vérifier le token Mapbox
if (!process.env.MAPBOX_TOKEN) {
  console.error('❌ ERREUR: MAPBOX_TOKEN manquant dans .env');
  console.log('👉 Ajoute ton token Mapbox dans le fichier .env');
  process.exit(1);
}

console.log('✅ Token Mapbox configuré');
console.log(`🌍 Mode: ${process.env.NODE_ENV || 'development'}`);

// ============================================
// ROUTES PROXY MAPBOX
// ============================================

// Proxy pour les tiles (images de carte)
app.get('/api/mapbox/tiles/:z/:x/:y', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const scale = req.query.scale || '';
    const retina = scale.includes('@2x') ? '@2x' : '';
    
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/${z}/${x}/${y}${retina}?access_token=${process.env.MAPBOX_TOKEN}`;
    
    console.log(`🗺️  Tile: z=${z}, x=${x}, y=${y}`);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Gbaka-Guides/1.0',
        'Accept': 'image/webp,*/*'
      }
    });
    
    // Définir les headers
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Erreur tile:', error.message);
    res.status(500).json({ 
      error: 'Erreur de chargement de la carte',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Proxy pour le geocoding
app.get('/api/mapbox/geocoding', async (req, res) => {
  try {
    const { q: query, limit = 5, country = 'ci' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Paramètre "q" requis' });
    }
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
    
    const params = {
      access_token: process.env.MAPBOX_TOKEN,
      country: country,
      limit: limit,
      language: 'fr',
      types: 'poi,address,neighborhood,place'
    };
    
    console.log(`🔍 Geocoding Mapbox: "${query}"`);
    
    const response = await axios.get(url, { params });
    
    res.json({
      success: true,
      query: query,
      results: response.data.features,
      attribution: "© Mapbox © OpenStreetMap"
    });
    
  } catch (error) {
    console.error('❌ Erreur geocoding Mapbox:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors de la recherche',
      details: error.message 
    });
  }
});

// RECHERCHE AVEC OPENSTREETMAP (Nominatim) - MEILLEUR POUR LES NOMS LOCAUX
app.get('/api/search/places', async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Paramètre "q" requis' });
    }
    
    // URL de l'API OpenStreetMap Nominatim
    const url = 'https://nominatim.openstreetmap.org/search';
    
    // Paramètres optimisés pour Abidjan
    const params = {
      q: query + ' Abidjan', // On force la recherche à Abidjan
      format: 'json',
      limit: limit,
      countrycodes: 'ci', // Côte d'Ivoire
      'accept-language': 'fr',
      viewbox: '-4.2,5.1,-3.9,5.5', // Zone autour d'Abidjan
      bounded: 1, // Seulement dans la zone
      addressdetails: 1 // Détails d'adresse
    };
    
    console.log(`🔍 OSM Search: "${query}"`);
    
    const response = await axios.get(url, { 
      params,
      headers: {
        'User-Agent': 'Gbaka-Guides-App/1.0 (gbaka-transport-app)'
      }
    });
    
    // Formater les résultats comme Mapbox (pour compatibilité)
    const formattedResults = response.data.map(place => {
      // Extraire le nom le plus simple
      let displayName = place.display_name;
      if (displayName.includes(',')) {
        displayName = displayName.split(',')[0]; // Premier élément
      }
      
      // Vérifier si c'est dans Abidjan
      const isInAbidjan = place.display_name.toLowerCase().includes('abidjan') || 
                         place.display_name.toLowerCase().includes('abj');
      
      return {
        id: place.place_id,
        type: 'Feature',
        place_type: [place.type || 'place'],
        relevance: isInAbidjan ? 1 : 0.5, // Priorité à Abidjan
        text: displayName,
        place_name: place.display_name,
        center: [parseFloat(place.lon), parseFloat(place.lat)],
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(place.lon), parseFloat(place.lat)]
        },
        properties: {
          category: place.type,
          importance: place.importance
        }
      };
    });
    
    // Trier par pertinence (Abidjan d'abord)
    formattedResults.sort((a, b) => b.relevance - a.relevance);
    
    res.json({
      success: true,
      query: query,
      results: formattedResults,
      attribution: "© OpenStreetMap contributors"
    });
    
  } catch (error) {
    console.error('❌ Erreur recherche OSM:', error.message);
    
    // Fallback: essayer Mapbox si OSM échoue
    try {
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(req.query.q)}.json`;
      const mapboxResponse = await axios.get(mapboxUrl, {
        params: {
          access_token: process.env.MAPBOX_TOKEN,
          country: 'CI',
          limit: 5,
          language: 'fr'
        }
      });
      
      res.json({
        success: true,
        query: req.query.q,
        results: mapboxResponse.data.features,
        attribution: "© Mapbox © OpenStreetMap",
        source: 'mapbox_fallback'
      });
      
    } catch (fallbackError) {
      res.status(500).json({ 
        success: false,
        error: 'Erreur de recherche',
        details: error.message 
      });
    }
  }
});

// Proxy pour les directions AVEC ÉTAPES DÉTAILLÉES
app.get('/api/mapbox/directions', async (req, res) => {
  try {
    const { from, to, profile = 'driving' } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ 
        error: 'Paramètres "from" et "to" requis' 
      });
    }
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from};${to}`;
    
    const params = {
      access_token: process.env.MAPBOX_TOKEN,
      alternatives: false,
      geometries: 'geojson',
      overview: 'full',
      steps: true, // IMPORTANT: pour avoir les étapes détaillées
      language: 'fr',
      voice_instructions: false,
      banner_instructions: false
    };
    
    console.log(`🧭 Directions: ${from} → ${to}`);
    
    const response = await axios.get(url, { params });
    
    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const legs = route.legs[0];
      
      // Formatter les étapes pour le frontend
      const formattedSteps = legs.steps.map((step, index) => ({
        number: index + 1,
        instruction: step.maneuver.instruction,
        distance: (step.distance / 1000).toFixed(1) + ' km',
        duration: Math.round(step.duration / 60) + ' min',
        maneuver: step.maneuver.type,
        modifier: step.maneuver.modifier
      }));
      
      res.json({
        success: true,
        route: {
          distance: route.distance,
          duration: route.duration,
          geometry: route.geometry
        },
        legs: [{
          summary: legs.summary,
          steps: formattedSteps,
          distance: legs.distance,
          duration: legs.duration
        }],
        waypoints: response.data.waypoints,
        fullRoute: route // Pour debug
      });
      
    } else {
      res.status(404).json({
        success: false,
        error: 'Aucun itinéraire trouvé'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur directions:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors du calcul d\'itinéraire',
      details: error.message 
    });
  }
});

// Proxy pour OpenStreetMap tiles
app.get('/api/osm/tiles/:z/:x/:y', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Gbaka-Guides/1.0'
      }
    });
    
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Erreur OSM tile:', error.message);
    res.status(500).json({ 
      error: 'Erreur de chargement de la carte OSM'
    });
  }
});

// ============================================
// ROUTES GBAKA
// ============================================

// Points d'intérêt Gbaka
const gbakaPoints = [
  {
    id: 1,
    name: "Gare Gbaka Yopougon",
    type: "gbaka",
    coordinates: [-4.065, 5.335],
    description: "Gare principale de Yopougon - Départ toutes les 5 min",
    price: 300,
    frequency: "5min",
    icon: "🚌",
    color: "#f97316",
    routes: ["Plateau", "Cocody", "Marcory"]
  },
  {
    id: 2,
    name: "Arrêt Wôrô-wôrô Cocody",
    type: "woroworo", 
    coordinates: [-4.055, 5.345],
    description: "Arrêt taxi partagé - Riviera Golf",
    price: 400,
    frequency: "2min",
    icon: "🚖",
    color: "#3b82f6",
    routes: ["Plateau", "Marcory", "Treichville"]
  },
  {
    id: 3,
    name: "Gare Plateau",
    type: "gbaka",
    coordinates: [-4.025, 5.325],
    description: "Terminus Plateau - Rue du Commerce",
    price: 300,
    frequency: "10min",
    icon: "🚌",
    color: "#f97316",
    routes: ["Yopougon", "Cocody", "Adjamé"]
  },
  {
    id: 4,
    name: "Station Adjamé",
    type: "gbaka",
    coordinates: [-4.035, 5.355],
    description: "Grande station - Toutes destinations",
    price: 250,
    frequency: "3min",
    icon: "🚌",
    color: "#10b981",
    routes: ["Yopougon", "Plateau", "Cocody", "Marcory", "Treichville"]
  },
  {
    id: 5,
    name: "Arrêt Marcory",
    type: "woroworo",
    coordinates: [-4.015, 5.315],
    description: "Marché Marcory - Taxis vers Plateau",
    price: 350,
    frequency: "5min",
    icon: "🚖",
    color: "#8b5cf6",
    routes: ["Plateau", "Cocody", "Treichville"]
  }
];

// Récupérer tous les points Gbaka
app.get('/api/gbaka/points', (req, res) => {
  res.json({
    success: true,
    count: gbakaPoints.length,
    points: gbakaPoints
  });
});

// Route santé
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Gbaka Guides API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mapbox: process.env.MAPBOX_TOKEN ? 'configured' : 'missing',
    endpoints: [
      'GET /api/health',
      'GET /api/mapbox/geocoding?q=...',
      'GET /api/mapbox/directions?from=...&to=...',
      'GET /api/search/places?q=... (OSM)',
      'GET /api/osm/tiles/{z}/{x}/{y}',
      'GET /api/gbaka/points'
    ]
  });
});

// Route 404 pour API
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Route API non trouvée',
    availableRoutes: [
      'GET /api/health',
      'GET /api/mapbox/geocoding?q=...',
      'GET /api/mapbox/directions?from=...&to=...',
      'GET /api/search/places?q=... (OSM)',
      'GET /api/osm/tiles/{z}/{x}/{y}',
      'GET /api/gbaka/points'
    ]
  });
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

app.listen(PORT, () => {
  console.log(`
  🚀 SERVEUR GBAKA GUIDES DÉMARRÉ !
  
  📍 Port: ${PORT}
  🌐 Mode: ${process.env.NODE_ENV || 'development'}
  🗺️  Mapbox: ✅ Configuré
  🗺️  OSM: ✅ Configuré
  
  📡 Routes disponibles:
     http://localhost:${PORT}/api/health
     http://localhost:${PORT}/api/mapbox/geocoding?q=Plateau
     http://localhost:${PORT}/api/search/places?q=Plateau
     http://localhost:${PORT}/api/mapbox/directions?from=-4.05,5.32&to=-4.02,5.33
     http://localhost:${PORT}/api/gbaka/points
  
  ⚡ Frontend: http://localhost:5173
  `);
});