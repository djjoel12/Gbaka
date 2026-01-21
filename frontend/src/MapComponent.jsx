import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  clearRoute
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markers = useRef([]);
  const routeLayer = useRef(null);
  const startMarker = useRef(null);
  const endMarker = useRef(null);

  // Initialiser la carte
  useEffect(() => {
    if (map.current) return;

    // Initialiser la carte Leaflet
    map.current = L.map(mapContainer.current, {
      center: [5.32, -4.05], // [lat, lng] pour Leaflet
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    // Ajouter les tuiles OpenStreetMap
    L.tileLayer('/api/osm/tiles/{z}/{x}/{y}', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.current);

    // Ajouter les contrôles
    L.control.zoom({ position: 'topright' }).addTo(map.current);

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

  // Ajouter les points Gbaka
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Nettoyer les anciens marqueurs (sauf start/end)
    markers.current.forEach(marker => {
      if (marker !== startMarker.current && marker !== endMarker.current) {
        marker.remove();
      }
    });
    markers.current = markers.current.filter(m => 
      m === startMarker.current || m === endMarker.current
    );

    // Ajouter chaque point Gbaka
    gbakaPoints.forEach(point => {
      const [lng, lat] = point.coordinates;
      
      // Créer une icône personnalisée
      const customIcon = L.divIcon({
        html: `
          <div style="
            width: 36px;
            height: 36px;
            background: ${point.color};
            border-radius: 50%;
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            ${point.icon}
          </div>
        `,
        className: 'gbaka-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map.current)
        .bindPopup(`
          <div style="padding: 12px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: ${point.color}">
              ${point.icon} ${point.name}
            </h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">
              ${point.description}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #888; font-size: 13px;">${point.frequency}</span>
              <strong style="color: ${point.color}; font-size: 18px;">${point.price} FCFA</strong>
            </div>
            <div style="margin-top: 10px;">
              <small style="color: #888;">Destinations: ${point.routes.join(', ')}</small>
            </div>
          </div>
        `);

      markers.current.push(marker);
    });

  }, [gbakaPoints, mapLoaded]);

  // Ajouter la position utilisateur
  useEffect(() => {
    if (!map.current || !mapLoaded || !userLocation) return;

    const [lng, lat] = userLocation;
    
    const userIcon = L.divIcon({
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #10b981;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
          animation: pulse 2s infinite;
        "></div>
      `,
      className: 'user-location',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const userMarker = L.marker([lat, lng], { 
      icon: userIcon,
      zIndexOffset: 1000
    })
      .addTo(map.current)
      .bindPopup('<strong>📍 Votre position actuelle</strong>')
      .openPopup();

    markers.current.push(userMarker);

    // Centrer sur la position
    map.current.setView([lat, lng], 14);

    return () => {
      userMarker.remove();
      markers.current = markers.current.filter(m => m !== userMarker);
    };
  }, [userLocation, mapLoaded]);

  // Ajouter les résultats de recherche
  useEffect(() => {
    if (!map.current || !mapLoaded || !searchResults || searchResults.length === 0) return;

    searchResults.forEach((result, index) => {
      const [lng, lat] = result.center;
      
      const searchIcon = L.divIcon({
        html: `
          <div style="
            position: relative;
            width: 24px;
            height: 24px;
            background: #3b82f6;
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
            box-shadow: 0 2px 6px rgba(59, 130, 246, 0.5);
          ">
            ${index + 1}
          </div>
        `,
        className: 'search-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], { icon: searchIcon })
        .addTo(map.current)
        .bindPopup(`
          <div style="padding: 10px; max-width: 250px;">
            <h4 style="margin: 0 0 6px 0; color: #1f2937;">${result.text}</h4>
            <p style="margin: 0; color: #666; font-size: 12px;">
              ${result.place_name}
            </p>
            <button onclick="navigator.clipboard.writeText('${lat.toFixed(6)}, ${lng.toFixed(6)}')" 
              style="margin-top: 8px; padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
              📋 Copier coordonnées
            </button>
          </div>
        `);

      markers.current.push(marker);
    });

    // Centrer sur le premier résultat
    if (searchResults[0]) {
      const [lng, lat] = searchResults[0].center;
      map.current.setView([lat, lng], 14);
    }

    return () => {
      // Nettoyer seulement les marqueurs de recherche
      markers.current.forEach(marker => {
        if (marker.options.icon?.options?.className === 'search-marker') {
          marker.remove();
        }
      });
      markers.current = markers.current.filter(m => 
        m.options.icon?.options?.className !== 'search-marker'
      );
    };
  }, [searchResults, mapLoaded]);

  // Afficher l'itinéraire
  useEffect(() => {
    if (!map.current || !mapLoaded || !routeData) return;

    // Nettoyer l'ancien itinéraire
    if (routeLayer.current) {
      routeLayer.current.remove();
    }
    if (startMarker.current) {
      startMarker.current.remove();
      startMarker.current = null;
    }
    if (endMarker.current) {
      endMarker.current.remove();
      endMarker.current = null;
    }

    // Extraire les données de l'itinéraire
    const { start, end, route, steps } = routeData;
    
    if (!route || !route.geometry) return;

    // Tracer la ligne de l'itinéraire
    routeLayer.current = L.geoJSON(route.geometry, {
      style: {
        color: '#3b82f6',
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round'
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
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
                ${start.text} → ${end.text}
              </p>
            </div>
          `);
        }
      }
    }).addTo(map.current);

    // Ajouter marqueur de départ
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
          ${start.text}<br>
          <small>${start.place_name}</small>
        </div>
      `);

    // Ajouter marqueur d'arrivée
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
          ${end.text}<br>
          <small>${end.place_name}</small>
        </div>
      `);

    // Ajouter les marqueurs à la liste
    markers.current.push(startMarker.current, endMarker.current);

    // Ajuster la vue pour voir tout l'itinéraire
    const bounds = routeLayer.current.getBounds();
    map.current.fitBounds(bounds.pad(0.1));

    // Zoomer un peu plus si la distance est courte
    const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
    if (boundsSize < 5000) { // moins de 5km
      map.current.setZoom(14);
    }

  }, [routeData, mapLoaded]);

  // Effet pour nettoyer l'itinéraire
  useEffect(() => {
    if (!clearRoute) return;
    
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
    
    // Filtrer les marqueurs start/end
    markers.current = markers.current.filter(m => 
      m !== startMarker.current && m !== endMarker.current
    );
    
  }, [clearRoute]);

  return (
    <div style={{ width: '100%', height: '600px', position: 'relative' }}>
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

      {/* Bouton pour effacer l'itinéraire */}
      {routeData && (
        <button
          onClick={() => {
            if (routeLayer.current) routeLayer.current.remove();
            if (startMarker.current) startMarker.current.remove();
            if (endMarker.current) endMarker.current.remove();
            routeLayer.current = null;
            startMarker.current = null;
            endMarker.current = null;
            // Appeler la fonction clearRoute du parent
            if (clearRoute) clearRoute();
          }}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            background: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '14px',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ❌ Effacer l'itinéraire
        </button>
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