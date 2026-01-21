import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importer pour décoder les polylines
import polyline from '@mapbox/polyline';

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function MapComponent({ 
  gbakaPoints, 
  userLocation, 
  searchResults, 
  routeData,
  clearRoute,
  onMapClick,
  mapClickMode
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markers = useRef([]);
  const routeLayer = useRef(null);
  const startMarker = useRef(null);
  const endMarker = useRef(null);
  const clickMarker = useRef(null);

  // Fonction pour décoder la polyline de Mapbox
  const decodePolyline = (encoded) => {
    if (!encoded) return [];
    
    try {
      // Si c'est déjà un tableau de coordonnées, le retourner tel quel
      if (Array.isArray(encoded)) return encoded;
      
      // Si c'est une polyline encodée, la décoder
      const decoded = polyline.decode(encoded);
      // Convertir [lat, lng] en [lng, lat] pour GeoJSON
      return decoded.map(([lat, lng]) => [lng, lat]);
    } catch (error) {
      console.error('Erreur décodage polyline:', error);
      return [];
    }
  };

  // Fonction pour créer un GeoJSON à partir des coordonnées
  const createRouteGeoJSON = (coordinates) => {
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates
      }
    };
  };

  // Initialiser la carte
  useEffect(() => {
    if (map.current) return;

    map.current = L.map(mapContainer.current, {
      center: [5.32, -4.05],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
      tap: true,
      touchZoom: true,
      scrollWheelZoom: true
    });

    // Ajouter les tuiles
    L.tileLayer('/api/osm/tiles/{z}/{x}/{y}', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.current);

    // Contrôles de zoom
    L.control.zoom({ position: 'topright' }).addTo(map.current);

    // Gérer les clics
    map.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      
      if (clickMarker.current) {
        clickMarker.current.remove();
      }
      
      const clickIcon = L.divIcon({
        html: `
          <div style="
            width: 40px;
            height: 40px;
            background: ${mapClickMode === 'start' ? '#10b981' : mapClickMode === 'end' ? '#ef4444' : '#3b82f6'};
            border-radius: 50%;
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: pulse 0.5s ease-in-out;
          ">
            ${mapClickMode === 'start' ? '🚩' : mapClickMode === 'end' ? '🏁' : '📍'}
          </div>
        `,
        className: 'click-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
      
      clickMarker.current = L.marker([lat, lng], { 
        icon: clickIcon,
        zIndexOffset: 2000
      }).addTo(map.current);
      
      if (onMapClick) {
        onMapClick([lng, lat]);
      }
    });

    map.current.whenReady(() => {
      console.log('✅ Carte Leaflet chargée');
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Afficher l'itinéraire - VERSION CORRIGÉE
  useEffect(() => {
    if (!map.current || !mapLoaded || !routeData) return;

    console.log('🔄 Affichage itinéraire:', routeData);

    // Nettoyer l'ancien itinéraire
    if (routeLayer.current) {
      routeLayer.current.remove();
      routeLayer.current = null;
    }
    if (startMarker.current) {
      startMarker.current.remove();
      startMarker.current = null;
    }
    if (endMarker.current) {
      endMarker.current.remove();
      endMarker.current = null;
    }

    const { start, end, route, geometry } = routeData;
    
    // 1. Préparer les coordonnées de l'itinéraire
    let routeCoordinates = [];
    
    if (geometry && geometry.coordinates) {
      // Si c'est déjà du GeoJSON
      routeCoordinates = geometry.coordinates;
      console.log('📐 Géométrie GeoJSON directe');
    } else if (route && route.geometry && route.geometry.coordinates) {
      // Si c'est dans route.geometry
      routeCoordinates = route.geometry.coordinates;
      console.log('📐 Géométrie dans route.geometry');
    } else if (route && route.geometry) {
      // Si c'est une polyline encodée
      try {
        routeCoordinates = decodePolyline(route.geometry);
        console.log('📐 Polyline décodée');
      } catch (error) {
        console.error('❌ Erreur décodage:', error);
      }
    }

    console.log('📏 Coordonnées itinéraire:', routeCoordinates.length, 'points');

    // 2. Tracer la ligne SI on a des coordonnées
    if (routeCoordinates.length > 0) {
      const routeGeoJSON = createRouteGeoJSON(routeCoordinates);
      
      routeLayer.current = L.geoJSON(routeGeoJSON, {
        style: {
          color: '#3b82f6',
          weight: 5,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round'
        },
        onEachFeature: (feature, layer) => {
          if (route && route.distance && route.duration) {
            layer.bindPopup(`
              <div style="padding: 10px; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #3b82f6;">Itinéraire calculé</h4>
                <p style="margin: 0 0 4px 0;">
                  <strong>Distance:</strong> ${(route.distance / 1000).toFixed(1)} km
                </p>
                <p style="margin: 0 0 4px 0;">
                  <strong>Durée:</strong> ${Math.round(route.duration / 60)} minutes
                </p>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">
                  ${start?.text || 'Départ'} → ${end?.text || 'Arrivée'}
                </p>
              </div>
            `);
          }
        }
      }).addTo(map.current);
      
      console.log('✅ Ligne itinéraire tracée');
    } else {
      console.warn('⚠️ Aucune coordonnée d\'itinéraire disponible');
    }

    // 3. Ajouter marqueur de départ
    if (start && start.center) {
      const [startLng, startLat] = start.center;
      
      const startIcon = L.divIcon({
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #10b981;
            border-radius: 50%;
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            🚩
          </div>
        `,
        className: 'start-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      startMarker.current = L.marker([startLat, startLng], { icon: startIcon })
        .addTo(map.current)
        .bindPopup(`
          <div style="padding: 10px;">
            <strong>📍 Départ</strong><br>
            ${start.text || 'Point de départ'}<br>
            <small>${start.place_name || ''}</small>
          </div>
        `);
        
      console.log('📍 Marqueur départ ajouté');
    }

    // 4. Ajouter marqueur d'arrivée
    if (end && end.center) {
      const [endLng, endLat] = end.center;
      
      const endIcon = L.divIcon({
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: #ef4444;
            border-radius: 50%;
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            🏁
          </div>
        `,
        className: 'end-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      endMarker.current = L.marker([endLat, endLng], { icon: endIcon })
        .addTo(map.current)
        .bindPopup(`
          <div style="padding: 10px;">
            <strong>🏁 Arrivée</strong><br>
            ${end.text || 'Point d\'arrivée'}<br>
            <small>${end.place_name || ''}</small>
          </div>
        `);
        
      console.log('🏁 Marqueur arrivée ajouté');
    }

    // 5. Ajuster la vue
    if (routeLayer.current && routeCoordinates.length > 0) {
      try {
        const bounds = routeLayer.current.getBounds();
        if (bounds.isValid()) {
          map.current.fitBounds(bounds.pad(0.1));
          console.log('🗺️ Vue ajustée sur itinéraire');
        }
      } catch (error) {
        console.error('❌ Erreur ajustement vue:', error);
      }
    } else if (startMarker.current && endMarker.current) {
      // Fallback : ajuster pour voir les deux marqueurs
      const startCoords = startMarker.current.getLatLng();
      const endCoords = endMarker.current.getLatLng();
      
      const bounds = L.latLngBounds([startCoords, endCoords]);
      map.current.fitBounds(bounds.pad(0.2));
      console.log('🗺️ Vue ajustée sur marqueurs');
    }

    // Nettoyage
    return () => {
      if (routeLayer.current) {
        routeLayer.current.remove();
        routeLayer.current = null;
      }
    };
  }, [routeData, mapLoaded]);

  // ... (le reste du code MapComponent reste le même)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Indicateur de chargement */}
      {!mapLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(30, 41, 59, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          borderRadius: '16px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(59, 130, 246, 0.3)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }}></div>
            <p style={{ color: '#cbd5e1' }}>Chargement de la carte...</p>
          </div>
        </div>
      )}

      {/* Conteneur de la carte */}
      <div 
        ref={mapContainer} 
        style={{ 
          width: '100%', 
          height: '100%',
          borderRadius: '16px'
        }}
      />

      {/* Légende */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '16px',
        color: 'white',
        fontSize: '14px',
        border: '1px solid rgba(255,255,255,0.1)',
        maxWidth: '200px'
      }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#e2e8f0' }}>
          🗺️ Légende
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#f97316',
              border: '2px solid white'
            }}></div>
            <span style={{ color: '#cbd5e1' }}>Gares Gbaka</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#3b82f6',
              border: '2px solid white'
            }}></div>
            <span style={{ color: '#cbd5e1' }}>Wôrô-wôrô</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#10b981',
              border: '2px solid white'
            }}></div>
            <span style={{ color: '#cbd5e1' }}>Votre position</span>
          </div>
          {routeData && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid white'
                }}></div>
                <span style={{ color: '#cbd5e1' }}>Départ</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid white'
                }}></div>
                <span style={{ color: '#cbd5e1' }}>Arrivée</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '20px',
                  height: '4px',
                  background: '#3b82f6',
                  borderRadius: '2px'
                }}></div>
                <span style={{ color: '#cbd5e1' }}>Itinéraire</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Indicateur mode sélection */}
      {mapClickMode && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '12px 20px',
          color: 'white',
          fontSize: '14px',
          border: `2px solid ${mapClickMode === 'start' ? '#10b981' : '#ef4444'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ fontSize: '20px' }}>
            {mapClickMode === 'start' ? '🚩' : '🏁'}
          </div>
          <div>
            <strong>Mode sélection activé</strong><br/>
            <small style={{ color: '#94a3b8' }}>
              Cliquez sur la carte pour choisir le {mapClickMode === 'start' ? 'départ' : 'arrivée'}
            </small>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .leaflet-container {
          border-radius: 16px;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        .leaflet-popup-content {
          font-family: inherit;
          border-radius: 8px;
        }
        
        .leaflet-control-zoom {
          border: 1px solid rgba(255,255,255,0.1) !important;
          background: rgba(15, 23, 42, 0.9) !important;
          backdrop-filter: blur(10px);
          border-radius: 8px !important;
          overflow: hidden;
        }
        
        .leaflet-control-zoom a {
          background: transparent !important;
          border: none !important;
          color: #cbd5e1 !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: rgba(255,255,255,0.1) !important;
          color: white !important;
        }
        
        .leaflet-div-icon {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}