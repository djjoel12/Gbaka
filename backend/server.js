import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Pour __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// SERVIR LE FRONTEND REACT BUILDÉ
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// TES ROUTES API (gardes tes routes existantes)
// ============================================

// Route santé
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Gbaka Guides Fullstack',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// Points Gbaka
app.get('/api/gbaka/points', (req, res) => {
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
    }
  ];
  
  res.json({
    success: true,
    count: gbakaPoints.length,
    points: gbakaPoints
  });
});

// Recherche OSM
app.get('/api/search/places', async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Paramètre "q" requis' });
    }
    
    console.log(`🔍 Recherche: "${query}"`);
    
    const url = 'https://nominatim.openstreetmap.org/search';
    
    const params = {
      q: query + ' Abidjan',
      format: 'json',
      limit: limit,
      countrycodes: 'ci',
      'accept-language': 'fr'
    };
    
    const response = await axios.get(url, { 
      params,
      headers: { 'User-Agent': 'Gbaka-Guides-App/1.0' }
    });
    
    const formattedResults = response.data.map(place => ({
      id: place.place_id,
      text: place.display_name.split(',')[0],
      place_name: place.display_name,
      center: [parseFloat(place.lon), parseFloat(place.lat)],
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(place.lon), parseFloat(place.lat)]
      }
    }));
    
    res.json({
      success: true,
      query: query,
      results: formattedResults,
      attribution: "© OpenStreetMap contributors"
    });
    
  } catch (error) {
    console.error('❌ Erreur recherche:', error.message);
    res.status(500).json({ error: 'Erreur de recherche' });
  }
});

// Itinéraires Mapbox
app.get('/api/mapbox/directions', async (req, res) => {
  try {
    const { from, to } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'Paramètres "from" et "to" requis' });
    }
    
    if (!process.env.MAPBOX_TOKEN) {
      return res.status(500).json({ error: 'Token Mapbox manquant' });
    }
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from};${to}`;
    
    const response = await axios.get(url, {
      params: {
        access_token: process.env.MAPBOX_TOKEN,
        geometries: 'geojson',
        overview: 'simplified',
        language: 'fr'
      }
    });
    
    if (response.data.routes && response.data.routes.length > 0) {
      res.json({
        success: true,
        route: response.data.routes[0],
        waypoints: response.data.waypoints
      });
    } else {
      res.status(404).json({ error: 'Aucun itinéraire trouvé' });
    }
    
  } catch (error) {
    console.error('❌ Erreur itinéraire:', error.message);
    res.status(500).json({ error: 'Erreur de calcul d\'itinéraire' });
  }
});

// Proxy OSM tiles
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
    console.error('❌ Erreur tile:', error.message);
    res.status(500).json({ error: 'Erreur de chargement de la carte' });
  }
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 GBAKA GUIDES - FULLSTACK EN LIGNE !
  📍 URL: https://gbaka.onrender.com
  🌐 Mode: ${process.env.NODE_ENV || 'production'}
  🗺️  Mapbox: ${process.env.MAPBOX_TOKEN ? '✅' : '❌'}
  📡 API: https://gbaka.onrender.com/api/health
  🖥️  Frontend: ✅ Servi depuis /public
  `);
});