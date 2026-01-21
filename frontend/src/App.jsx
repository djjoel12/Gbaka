import React, { useState, useEffect, useRef } from 'react';
import MapComponent from './MapComponent';

export default function App() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [gbakaPoints, setGbakaPoints] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [showRouteInput, setShowRouteInput] = useState(false);
  const [startPoint, setStartPoint] = useState('');
  const [endPoint, setEndPoint] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mapClickMode, setMapClickMode] = useState(null);
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'route', 'saved'
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef(null);

  // Détecter le mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Charger les points Gbaka
  useEffect(() => {
    fetch('/api/gbaka/points')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGbakaPoints(data.points);
        }
      })
      .catch(err => console.error('Erreur:', err));
  }, []);

  // Focus sur la barre de recherche quand on change d'onglet
  useEffect(() => {
    if (activeTab === 'search' && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [activeTab]);

  // Obtenir la position GPS
  const getLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          
          // Si on est en mode itinéraire, remplir automatiquement
          if (activeTab === 'route') {
            setStartPoint(`Ma position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
          setLoading(false);
        },
        (error) => {
          console.log('GPS désactivé:', error);
          alert('Activez la géolocalisation dans les paramètres de votre navigateur.');
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
    }
  };

  // Rechercher un lieu
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;

    setLoading(true);
    try {
      const osmResponse = await fetch(
        `/api/search/places?q=${encodeURIComponent(search)}&limit=5`
      );
      const osmData = await osmResponse.json();
      
      if (osmData.success && osmData.results.length > 0) {
        setResults(osmData.results);
      } else {
        const mapboxResponse = await fetch(
          `/api/mapbox/geocoding?q=${encodeURIComponent(search)}&limit=5&country=ci`
        );
        const mapboxData = await mapboxResponse.json();
        
        if (mapboxData.results && mapboxData.results.length > 0) {
          setResults(mapboxData.results);
        } else {
          alert('Aucun résultat pour "' + search + '"');
        }
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour géocoder une adresse
  const geocodeAddress = async (address) => {
    try {
      if (address.includes('Ma position') && userLocation) {
        return {
          coords: userLocation,
          name: "Ma position"
        };
      }
      
      const coordRegex = /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/;
      if (coordRegex.test(address)) {
        const [lat, lng] = address.split(',').map(coord => parseFloat(coord.trim()));
        return {
          coords: [lng, lat],
          name: `Position (${lat.toFixed(4)}, ${lng.toFixed(4)})`
        };
      }
      
      // Essayer OSM d'abord
      try {
        const osmResponse = await fetch(
          `/api/search/places?q=${encodeURIComponent(address)}&limit=1`
        );
        const osmData = await osmResponse.json();
        
        if (osmData.results && osmData.results.length > 0) {
          const result = osmData.results[0];
          return {
            coords: result.center,
            name: result.text || result.place_name
          };
        }
      } catch (osmError) {
        console.log('OSM échoué, essaye Mapbox...');
      }
      
      // Essayer Mapbox
      const mapboxResponse = await fetch(
        `/api/mapbox/geocoding?q=${encodeURIComponent(address)}&limit=1&country=ci`
      );
      const mapboxData = await mapboxResponse.json();
      
      if (mapboxData.results && mapboxData.results.length > 0) {
        const result = mapboxData.results[0];
        return {
          coords: result.center,
          name: result.text || result.place_name
        };
      }
      
      throw new Error(`Lieu "${address}" non trouvé`);
      
    } catch (error) {
      throw error;
    }
  };

  // Calculer un itinéraire
  const handleRouteCalculate = async () => {
    if (!startPoint.trim() || !endPoint.trim()) {
      alert('Saisissez le point de départ et la destination');
      return;
    }

    setLoading(true);
    
    try {
      const startInfo = await geocodeAddress(startPoint);
      const endInfo = await geocodeAddress(endPoint);
      
      const routeRes = await fetch(
        `/api/mapbox/directions?from=${startInfo.coords.join(',')}&to=${endInfo.coords.join(',')}`
      );
      
      const routeInfo = await routeRes.json();
      
      if (routeInfo.success) {
        setRouteData({
          start: {
            text: startInfo.name,
            place_name: startInfo.name,
            center: startInfo.coords
          },
          end: {
            text: endInfo.name,
            place_name: endInfo.name,
            center: endInfo.coords
          },
          route: routeInfo.route,
          legs: routeInfo.legs || [],
          steps: routeInfo.legs?.[0]?.steps || [],
          geometry: routeInfo.route.geometry,
          distance: routeInfo.route.distance,
          duration: routeInfo.route.duration
        });
        
        // Retourner à la carte
        setActiveTab('map');
        setSearch('');
        setResults([]);
        setMapClickMode(null);
        
      } else {
        throw new Error(routeInfo.error || 'Erreur de calcul d\'itinéraire');
      }
      
    } catch (error) {
      console.error('Erreur itinéraire:', error);
      alert(`Erreur: ${error.message}\n\nVérifiez que les noms de lieux sont corrects.`);
    } finally {
      setLoading(false);
    }
  };

  // Effacer l'itinéraire
  const clearRoute = () => {
    setRouteData(null);
    setStartPoint('');
    setEndPoint('');
    setActiveTab('search');
    setMapClickMode(null);
  };

  // Utiliser un résultat comme destination
  const useResultAsDestination = (result) => {
    setEndPoint(result.text || result.place_name);
    setActiveTab('route');
    setSearch('');
    setResults([]);
  };

  // Gérer le clic sur la carte
  const handleMapClick = (coords) => {
    const [lng, lat] = coords;
    const positionString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    if (mapClickMode === 'start') {
      setStartPoint(positionString);
      setMapClickMode(null);
    } else if (mapClickMode === 'end') {
      setEndPoint(positionString);
      setMapClickMode(null);
    } else if (activeTab === 'route') {
      const choice = prompt(
        `Position: ${positionString}\n\nUtiliser pour:\n1. Point de départ\n2. Point d'arrivée\n3. Annuler\n\nEntrez 1, 2 ou 3`
      );
      
      if (choice === '1') {
        setStartPoint(positionString);
      } else if (choice === '2') {
        setEndPoint(positionString);
      }
    }
  };

  // Composants pour mobile
  const MobileHeader = () => (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.97)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      padding: '12px 16px'
    }}>
      {/* Barre de recherche compacte */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => setIsSearchExpanded(!isSearchExpanded)}
          style={{
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          {isSearchExpanded ? '✕' : '🔍'}
        </button>
        
        {!isSearchExpanded && (
          <div style={{ flex: 1 }}>
            <div style={{ 
              padding: '10px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              color: '#94a3b8',
              fontSize: '14px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              Rechercher un lieu...
            </div>
          </div>
        )}
        
        <button
          onClick={getLocation}
          style={{
            width: '40px',
            height: '40px',
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981',
            fontSize: '18px',
            cursor: 'pointer'
          }}
        >
          📍
        </button>
      </div>
      
      {/* Barre de recherche étendue */}
      {isSearchExpanded && (
        <div style={{ marginTop: '12px' }}>
          <form onSubmit={handleSearch}>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lieu à Abidjan..."
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '10px',
                fontSize: '16px',
                color: 'white',
                outline: 'none'
              }}
            />
          </form>
        </div>
      )}
    </div>
  );

  const MobileBottomNav = () => (
    <div style={{
      position: 'fixed',
      bottom: '0',
      left: '0',
      right: '0',
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.98)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '8px 16px 20px',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.3)'
    }}>
      {/* Boutons principaux */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around',
        marginBottom: '12px'
      }}>
        <NavButton
          active={activeTab === 'search'}
          onClick={() => {
            setActiveTab('search');
            setIsSearchExpanded(true);
          }}
          icon="🔍"
          label="Recherche"
        />
        
        <NavButton
          active={activeTab === 'route'}
          onClick={() => setActiveTab('route')}
          icon="🧭"
          label="Itinéraire"
        />
        
        <NavButton
          active={activeTab === 'saved'}
          onClick={() => setActiveTab('saved')}
          icon="⭐"
          label="Favoris"
        />
        
        <NavButton
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
          icon="⚙️"
          label="Options"
        />
      </div>
      
      {/* Panneau d'itinéraire */}
      {activeTab === 'route' && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.9)',
          borderRadius: '12px',
          padding: '12px',
          marginTop: '8px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Départ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                background: '#10b981', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px'
              }}>
                A
              </div>
              <input
                type="text"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
                placeholder="Point de départ"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'white'
                }}
              />
              <button
                onClick={() => setMapClickMode('start')}
                style={{
                  padding: '8px',
                  background: mapClickMode === 'start' ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: mapClickMode === 'start' ? 'white' : '#3b82f6',
                  fontSize: '14px'
                }}
              >
                🗺️
              </button>
            </div>
            
            {/* Arrivée */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ 
                width: '24px', 
                height: '24px', 
                background: '#ef4444', 
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '12px'
              }}>
                B
              </div>
              <input
                type="text"
                value={endPoint}
                onChange={(e) => setEndPoint(e.target.value)}
                placeholder="Destination"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'white'
                }}
              />
              <button
                onClick={() => setMapClickMode('end')}
                style={{
                  padding: '8px',
                  background: mapClickMode === 'end' ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: mapClickMode === 'end' ? 'white' : '#3b82f6',
                  fontSize: '14px'
                }}
              >
                🗺️
              </button>
            </div>
            
            {/* Boutons d'action */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setStartPoint('');
                  setEndPoint('');
                  setMapClickMode(null);
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}
              >
                Effacer
              </button>
              <button
                onClick={handleRouteCalculate}
                disabled={loading || !startPoint.trim() || !endPoint.trim()}
                style={{
                  flex: 2,
                  padding: '10px',
                  background: loading || !startPoint.trim() || !endPoint.trim() 
                    ? 'rgba(16, 185, 129, 0.3)' 
                    : 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {loading ? 'Calcul...' : 'Calculer l\'itinéraire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const NavButton = ({ active, onClick, icon, label }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        background: 'transparent',
        border: 'none',
        color: active ? '#3b82f6' : '#94a3b8',
        padding: '8px 12px',
        borderRadius: '8px',
        minWidth: '60px'
      }}
    >
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <span style={{ fontSize: '11px', fontWeight: active ? '600' : '400' }}>
        {label}
      </span>
    </button>
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#1e293b',
      position: 'relative'
    }}>
      {/* Version Desktop */}
      {!isMobile ? (
        <>
          {/* Header Desktop */}
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.97)',
            backdropFilter: 'blur(10px)',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              alignItems: 'center',
              maxWidth: '1400px', 
              margin: '0 auto' 
            }}>
              {/* Logo */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                flexShrink: 0 
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  🚌
                </div>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: 'white'
                }}>
                  Gbaka Maps
                </span>
              </div>

              {/* Barre de recherche */}
              <form onSubmit={handleSearch} style={{ flex: 1 }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '10px',
                  maxWidth: '600px'
                }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un lieu à Abidjan..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '2px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      fontSize: '15px',
                      color: 'white',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '10px',
                      fontWeight: '600',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '15px',
                      flexShrink: 0
                    }}
                  >
                    {loading ? '⏳' : 'Rechercher'}
                  </button>
                </div>
              </form>

              {/* Boutons d'action */}
              <div style={{ 
                display: 'flex', 
                gap: '10px', 
                flexShrink: 0
              }}>
                <button
                  onClick={getLocation}
                  disabled={loading}
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  📍 Ma position
                </button>
                
                <button
                  onClick={() => setActiveTab(activeTab === 'route' ? 'map' : 'route')}
                  style={{
                    background: activeTab === 'route' ? '#3b82f6' : 'rgba(59, 130, 246, 0.2)',
                    color: activeTab === 'route' ? 'white' : '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🧭 Itinéraire
                </button>
              </div>
            </div>
          </div>

          {/* Panneau latéral pour itinéraire (Desktop) */}
          {activeTab === 'route' && (
            <div style={{
              position: 'fixed',
              top: '80px',
              left: '20px',
              width: '350px',
              zIndex: 999,
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '20px' }}>
                <h3 style={{ 
                  color: 'white', 
                  marginBottom: '20px',
                  fontSize: '18px'
                }}>
                  🧭 Calcul d'itinéraire
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Départ */}
                  <div>
                    <div style={{ 
                      color: '#10b981', 
                      fontSize: '12px',
                      marginBottom: '6px'
                    }}>
                      Point de départ
                    </div>
                    <input
                      type="text"
                      value={startPoint}
                      onChange={(e) => setStartPoint(e.target.value)}
                      placeholder="Ex: Yopougon, Cocody..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: 'white'
                      }}
                    />
                  </div>
                  
                  {/* Arrivée */}
                  <div>
                    <div style={{ 
                      color: '#ef4444', 
                      fontSize: '12px',
                      marginBottom: '6px'
                    }}>
                      Destination
                    </div>
                    <input
                      type="text"
                      value={endPoint}
                      onChange={(e) => setEndPoint(e.target.value)}
                      placeholder="Ex: Plateau, Marcory..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '2px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: 'white'
                      }}
                    />
                  </div>
                  
                  {/* Boutons d'action */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => {
                        if (userLocation) {
                          setStartPoint(`Ma position (${userLocation[1].toFixed(4)}, ${userLocation[0].toFixed(4)})`);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        color: '#10b981',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      📍 Départ
                    </button>
                    
                    <button
                      onClick={handleRouteCalculate}
                      disabled={loading || !startPoint.trim() || !endPoint.trim()}
                      style={{
                        flex: 2,
                        padding: '10px',
                        background: loading || !startPoint.trim() || !endPoint.trim() 
                          ? 'rgba(16, 185, 129, 0.3)' 
                          : 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {loading ? '⏳ Calcul...' : 'Calculer l\'itinéraire'}
                    </button>
                  </div>
                  
                  {/* Exemples */}
                  <div>
                    <div style={{ 
                      color: '#94a3b8', 
                      fontSize: '12px',
                      marginBottom: '8px'
                    }}>
                      Itinéraires rapides:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[
                        { start: 'Yopougon', end: 'Plateau' },
                        { start: 'Cocody', end: 'Marcory' },
                        { start: 'Adjamé', end: 'Treichville' },
                        { start: 'Koumassi', end: 'Abobo' }
                      ].map((route, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setStartPoint(route.start);
                            setEndPoint(route.end);
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '6px',
                            color: '#3b82f6',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {route.start} → {route.end}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Mobile Header */}
          <MobileHeader />
          
          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />
        </>
      )}

      {/* Carte */}
      <div style={{ 
        position: 'fixed',
        top: isMobile ? (isSearchExpanded ? '120px' : '64px') : '80px',
        left: '0',
        right: '0',
        bottom: isMobile ? (activeTab === 'route' ? '200px' : '80px') : '0'
      }}>
        <MapComponent 
          gbakaPoints={gbakaPoints}
          userLocation={userLocation}
          searchResults={results}
          routeData={routeData}
          clearRoute={clearRoute}
          onMapClick={handleMapClick}
          mapClickMode={mapClickMode}
        />
      </div>

      {/* Résultats de recherche (Mobile & Desktop) */}
      {results.length > 0 && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '64px' : '80px',
          left: isMobile ? '16px' : (activeTab === 'route' ? '390px' : '20px'),
          right: isMobile ? '16px' : '20px',
          maxHeight: '60vh',
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflowY: 'auto',
          zIndex: 998,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
        }}>
          <div style={{ padding: '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                {results.length} résultat{results.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setResults([])}
                style={{
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  padding: '4px 8px'
                }}
              >
                ✕ Fermer
              </button>
            </div>
            
            {results.map((result, index) => (
              <div
                key={index}
                onClick={() => useResultAsDestination(result)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  border: '1px solid transparent',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{ 
                  fontWeight: '600', 
                  color: 'white',
                  fontSize: '14px',
                  marginBottom: '4px'
                }}>
                  {result.text}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#94a3b8',
                  lineHeight: '1.4'
                }}>
                  {result.place_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info itinéraire actuel (badge compact) */}
      {routeData && (
        <div style={{
          position: 'fixed',
          [isMobile ? 'bottom' : 'top']: isMobile ? '90px' : '90px',
          left: isMobile ? '16px' : '20px',
          right: isMobile ? '16px' : 'auto',
          width: isMobile ? 'auto' : '350px',
          background: 'rgba(15, 23, 42, 0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '12px',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 997,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '4px'
              }}>
                <div style={{ color: '#10b981', fontSize: '14px' }}>🚩</div>
                <div style={{ 
                  fontSize: '13px', 
                  color: 'white',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {routeData.start.text}
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px'
              }}>
                <div style={{ color: '#ef4444', fontSize: '14px' }}>🏁</div>
                <div style={{ 
                  fontSize: '13px', 
                  color: 'white',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {routeData.end.text}
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '12px',
                marginTop: '8px',
                fontSize: '12px',
                color: '#94a3b8'
              }}>
                <span>📏 {(routeData.distance / 1000).toFixed(1)} km</span>
                <span>⏱️ {Math.round(routeData.duration / 60)} min</span>
              </div>
            </div>
            
            <button
              onClick={clearRoute}
              style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '12px',
                flexShrink: 0
              }}
            >
              Effacer
            </button>
          </div>
        </div>
      )}

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          overflow: hidden;
        }
        
        ::placeholder {
          color: #94a3b8;
          opacity: 0.7;
        }
        
        button {
          cursor: pointer;
          transition: all 0.2s;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        button:active {
          transform: scale(0.98);
        }
        
        /* Améliorations pour mobile */
        @media (max-width: 768px) {
          input, button {
            font-size: 16px !important;
          }
          
          button {
            -webkit-tap-highlight-color: transparent;
          }
          
          /* Empêcher le zoom sur iOS */
          input {
            font-size: 16px !important;
            transform: scale(1);
          }
        }
        
        /* Scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* Animation pour le clic */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Smooth transitions */
        .search-panel {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
