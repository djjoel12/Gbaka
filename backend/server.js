import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

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
    const scale = req.query.scale || '@2x';
    
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/${z}/${x}/${y}${scale}?access_token=${process.env.MAPBOX_TOKEN}`;
    
    console.log(`🗺️  Tile request: z=${z}, x=${x}, y=${y}`);
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Gbaka-Guides/1.0'
      }
    });
    
    // Définir les headers appropriés
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.set('Access-Control-Allow-Origin', '*');
    
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Erreur proxy tile:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors du chargement de la carte',
      details: error.message 
    });
  }
});

// Proxy pour le geocoding (recherche d'adresses)
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
    
    console.log(`🔍 Geocoding request: "${query}"`);
    
    const response = await axios.get(url, { params });
    
    res.json({
      success: true,
      query: query,
      results: response.data.features,
      attribution: "© Mapbox © OpenStreetMap"
    });
    
  } catch (error) {
    console.error('❌ Erreur geocoding:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors de la recherche',
      details: error.message 
    });
  }
});

// Proxy pour les directions (itinéraires)
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
      alternatives: true,
      geometries: 'geojson',
      overview: 'full',
      steps: true,
      language: 'fr'
    };
    
    console.log(`🧭 Directions: ${from} → ${to} (${profile})`);
    
    const response = await axios.get(url, { params });
    
    res.json({
      success: true,
      route: response.data.routes[0],
      alternatives: response.data.routes.slice(1),
      waypoints: response.data.waypoints
    });
    
  } catch (error) {
    console.error('❌ Erreur directions:', error.message);
    res.status(500).json({ 
      error: 'Erreur lors du calcul d\'itinéraire',
      details: error.message 
    });
  }
});

// Proxy pour le style de carte
app.get('/api/mapbox/style', async (req, res) => {
  try {
    const style = req.query.style || 'streets-v12';
    
    const url = `https://api.mapbox.com/styles/v1/mapbox/${style}`;
    
    const response = await axios.get(url, {
      params: {
        access_token: process.env.MAPBOX_TOKEN
      }
    });
    
    // Remplacer les URLs par nos URLs proxy
    const styleData = response.data;
    if (styleData.sources) {
      // Remplacer les sources vectorielles
      Object.keys(styleData.sources).forEach(sourceKey => {
        const source = styleData.sources[sourceKey];
        if (source.url && source.url.includes('mapbox://')) {
          // Convertir en URL proxy
          source.url = source.url.replace('mapbox://', '/api/mapbox/tiles/');
        }
      });
    }
    
    res.json(styleData);
    
  } catch (error) {
    console.error('❌ Erreur style:', error.message);
    res.status(500).json({ error: 'Erreur lors du chargement du style' });
  }
});

// ============================================
// ROUTES GBAKA (tes données)
// ============================================

// Points d'intérêt Gbaka
const gbakaPoints = [
  {
    id: 1,
    name: "Gare Gbaka Yopougon",
    type: "gbaka",
    coordinates: [-4.065, 5.335],
    description: "Gare principale de Yopougon",
    price: 300,
    frequency: "5min",
    icon: "🚌",
    color: "#f97316"
  },
  {
    id: 2,
    name: "Arrêt Wôrô-wôrô Cocody",
    type: "woroworo", 
    coordinates: [-4.055, 5.345],
    description: "Arrêt taxi partagé",
    price: 400,
    frequency: "2min",
    icon: "🚖",
    color: "#3b82f6"
  },
  {
    id: 3,
    name: "Gare Plateau",
    type: "gbaka",
    coordinates: [-4.025, 5.325],
    description: "Terminus Plateau",
    price: 300,
    frequency: "10min",
    icon: "🚌",
    color: "#f97316"
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

// Rechercher des points par type
app.get('/api/gbaka/points/:type', (req, res) => {
  const { type } = req.params;
  const filtered = gbakaPoints.filter(point => point.type === type);
  
  res.json({
    success: true,
    type: type,
    count: filtered.length,
    points: filtered
  });
});

// Itinéraires populaires
app.get('/api/gbaka/routes/popular', (req, res) => {
  const popularRoutes = [
    {
      id: 1,
      from: "Yopougon",
      to: "Plateau",
      price: 300,
      duration: 42,
      distance: 12,
      steps: [
        "Trouver la gare Gbaka Yopougon",
        "Prendre le gbaka orange/bleu",
        "Payer 300 FCFA",
        "Descendre au terminus Plateau"
      ],
      popularity: 95
    },
    {
      id: 2,
      from: "Cocody",
      to: "Marcory", 
      price: 400,
      duration: 35,
      distance: 8,
      steps: [
        "Aller à l'arrêt Cocody Riviera",
        "Prendre le woroworo jaune",
        "Payer 400 FCFA",
        "Dire 'Marcory marché' au chauffeur"
      ],
      popularity: 87
    }
  ];
  
  res.json({
    success: true,
    routes: popularRoutes
  });
});

// ============================================
// ROUTES UTILISATEUR & AUTH (pour plus tard)
// ============================================

// Route test
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Gbaka Guides API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    mapbox: process.env.MAPBOX_TOKEN ? 'configured' : 'missing'
  });
});

// Route 404
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    availableRoutes: [
      'GET /api/health',
      'GET /api/mapbox/geocoding?q=...',
      'GET /api/mapbox/directions?from=...&to=...',
      'GET /api/gbaka/points',
      'GET /api/gbaka/routes/popular'
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
  🗺️  Mapbox: ${process.env.MAPBOX_TOKEN ? '✅ Configuré' : '❌ Manquant'}
  
  📡 Routes disponibles:
     http://localhost:${PORT}/api/health
     http://localhost:${PORT}/api/mapbox/geocoding?q=Plateau
     http://localhost:${PORT}/api/gbaka/points
  
  ⚡ Frontend: http://localhost:5173
  `);
});