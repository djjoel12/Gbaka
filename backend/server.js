import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware CORS amélioré
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://gbaka.onrender.com', 'https://gbaka-guides.onrender.com'] 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Servir le frontend React
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// VÉRIFICATION CONFIGURATION
// ============================================
if (!process.env.MAPBOX_TOKEN && process.env.NODE_ENV !== 'test') {
  console.error('❌ ERREUR: MAPBOX_TOKEN manquant dans .env');
  console.log('ℹ️  Ajoute ton token Mapbox dans le fichier .env');
  process.exit(1);
}

console.log('✅ Configuration chargée');
console.log(`🌐 Mode: ${process.env.NODE_ENV || 'production'}`);

// ============================================
// DONNÉES GBAKA
// ============================================
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

// ============================================
// API ROUTES
// ============================================

// Route santé
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Gbaka Guides Fullstack',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    mapbox: process.env.MAPBOX_TOKEN ? 'configured' : 'missing',
    endpoints: [
      'GET /api/health',
      'GET /api/gbaka/points',
      'GET /api/mapbox/geocoding?q=...',
      'GET /api/mapbox/directions?from=...&to=...',
      'GET /api/search/places?q=...',
      'GET /api/osm/tiles/{z}/{x}/{y}'
    ]
  });
});

// Points Gbaka
app.get('/api/gbaka/points', (req, res) => {
  res.json({
    success: true,
    count: gbakaPoints.length,
    points: gbakaPoints
  });
});

// Géocoding Mapbox
app.get('/api/mapbox/geocoding', async (req, res) => {
  try {
    const { q: query, limit = 5, country = 'ci' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Paramètre "q" requis' });
    }
    
    // Vérifier si c'est déjà des coordonnées
    const coordRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
    if (coordRegex.test(query)) {
      const [lat, lng] = query.split(',').map(coord => parseFloat(coord.trim()));
      
      // Retourner directement les coordonnées
      return res.json({
        success: true,
        query: query,
        results: [{
          id: 'coords-' + Date.now(),
          type: 'Feature',
          place_type: ['coordinate'],
          text: `Position (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          place_name: `Position: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          center: [lng, lat], // Mapbox format: [longitude, latitude]
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          properties: {
            category: 'coordinate'
          }
        }],
        attribution: "© Mapbox © OpenStreetMap"
      });
    }
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
    
    const params = {
      access_token: process.env.MAPBOX_TOKEN,
      country: country,
      limit: limit,
      language: 'fr',
      types: 'poi,address,neighborhood,place'
    };
    
    console.log(`🔍 Géocoding Mapbox: "${query}"`);
    
    const response = await axios.get(url, { params });
    
    res.json({
      success: true,
      query: query,
      results: response.data.features,
      attribution: "© Mapbox © OpenStreetMap"
    });
    
  } catch (error) {
    console.error('❌ Erreur géocoding Mapbox:', error.message);
    
    // Donner une erreur plus informative
    if (error.response) {
      res.status(error.response.status).json({
        error: 'Erreur Mapbox',
        details: error.response.data.message || error.message
      });
    } else {
      res.status(500).json({
        error: 'Erreur de connexion à Mapbox',
        details: error.message
      });
    }
  }
});

// Recherche OSM
app.get('/api/search/places', async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Paramètre "q" requis' });
    }
    
    console.log(`🔍 Recherche OSM: "${query}"`);
    
    const url = 'https://nominatim.openstreetmap.org/search';
    
    // Paramètres optimisés pour Abidjan
    const params = {
      q: query,
      format: 'json',
      limit: limit,
      countrycodes: 'ci',
      'accept-language': 'fr',
      viewbox: '-4.2,5.1,-3.9,5.5', // Zone Abidjan
      bounded: 0,
      addressdetails: 1,
      polygon_geojson: 0
    };
    
    const response = await axios.get(url, { 
      params,
      headers: { 
        'User-Agent': 'Gbaka-Guides-App/1.0 (contact@gbaka.com)',
        'Referer': 'https://gbaka.onrender.com'
      }
    });
    
    // Formater les résultats mieux
    const formattedResults = response.data.map(place => {
      // Trouver le meilleur nom à afficher
      let displayName = place.display_name;
      let shortName = displayName.split(',')[0];
      
      // Si c'est dans Abidjan, essayer d'avoir un nom plus court
      if (displayName.includes('Abidjan')) {
        const parts = displayName.split(',');
        // Prendre les 2 premières parties si possible
        if (parts.length > 1) {
          shortName = parts[0].trim() + ', ' + parts[1].trim();
        }
      }
      
      return {
        id: place.place_id,
        text: shortName,
        place_name: displayName,
        center: [parseFloat(place.lon), parseFloat(place.lat)],
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(place.lon), parseFloat(place.lat)]
        },
        properties: {
          type: place.type,
          importance: place.importance,
          address: place.address
        }
      };
    });
    
    // Trier par importance
    formattedResults.sort((a, b) => 
      (b.properties.importance || 0) - (a.properties.importance || 0)
    );
    
    res.json({
      success: true,
      query: query,
      results: formattedResults,
      attribution: "© OpenStreetMap contributors"
    });
    
  } catch (error) {
    console.error('❌ Erreur recherche OSM:', error.message);
    
    // Fallback simple vers Mapbox
    try {
      if (!process.env.MAPBOX_TOKEN) {
        throw new Error('Token Mapbox manquant');
      }
      
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(req.query.q)}.json`;
      
      const mapboxResponse = await axios.get(mapboxUrl, {
        params: {
          access_token: process.env.MAPBOX_TOKEN,
          country: 'CI',
          limit: limit || 5,
          language: 'fr',
          types: 'region,place,locality,neighborhood'
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
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Directions Mapbox
app.get('/api/mapbox/directions', async (req, res) => {
  try {
    const { from, to, profile = 'driving' } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'Paramètres "from" et "to" requis' });
    }
    
    console.log(`📍 Directions Mapbox: ${from} → ${to}`);
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from};${to}`;
    
    const params = {
      access_token: process.env.MAPBOX_TOKEN,
      alternatives: false,
      geometries: 'geojson',
      overview: 'full',
      steps: true,
      language: 'fr',
      voice_instructions: false,
      banner_instructions: false
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const legs = route.legs[0];
      
      // Formatter les étapes
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
        waypoints: response.data.waypoints
      });
      
    } else {
      res.status(404).json({
        success: false,
        error: 'Aucun itinéraire trouvé'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur directions:', error.message);
    
    // Erreur plus descriptive
    let errorMessage = 'Erreur de calcul d\'itinéraire';
    let errorDetails = error.message;
    
    if (error.response) {
      errorMessage = error.response.data.message || errorMessage;
      errorDetails = JSON.stringify(error.response.data);
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
    });
  }
});

// Tiles OSM
app.get('/api/osm/tiles/:z/:x/:y', async (req, res) => {
  try {
    const { z, x, y } = req.params;
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Gbaka-Guides/1.0' }
    });
    
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400'
    });
    
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Erreur tile OSM:', error.message);
    res.status(500).json({ error: 'Erreur de chargement de la carte' });
  }
});

// ============================================
// 404 API
// ============================================
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Route API non trouvée',
    availableRoutes: [
      'GET /api/health',
      'GET /api/gbaka/points',
      'GET /api/mapbox/geocoding?q=...',
      'GET /api/mapbox/directions?from=...&to=...',
      'GET /api/search/places?q=...',
      'GET /api/osm/tiles/{z}/{x}/{y}'
    ]
  });
});

// ============================================
// TOUTES LES AUTRES ROUTES → FRONTEND REACT
// ============================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// DÉMARRAGE
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const baseUrl = isProduction 
    ? 'https://gbaka.onrender.com' 
    : `http://localhost:${PORT}`;
  
  console.log(`
  🚀 GBAKA GUIDES - FULLSTACK CORRIGÉ !
  
  📍 URL: ${baseUrl}
  🌐 Mode: ${process.env.NODE_ENV || 'production'}
  🗺️  Mapbox: ${process.env.MAPBOX_TOKEN ? '✅ Configuré' : '❌ Manquant'}
  🚌 Points Gbaka: ${gbakaPoints.length}
  
  📡 API Endpoints:
  ✅ ${baseUrl}/api/health
  ✅ ${baseUrl}/api/gbaka/points
  ✅ ${baseUrl}/api/mapbox/geocoding?q=Plateau
  ✅ ${baseUrl}/api/search/places?q=Plateau
  ✅ ${baseUrl}/api/mapbox/directions?from=-4.05,5.32&to=-4.02,5.33
  ✅ ${baseUrl}/api/osm/tiles/{z}/{x}/{y}
  
  🖥️  Frontend: ✅ Servi depuis /public
  🕐 ${new Date().toLocaleString()}
  `);
});

// Gestion des erreurs
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Le port ${PORT} est déjà utilisé`);
    process.exit(1);
  }
  throw error;
});