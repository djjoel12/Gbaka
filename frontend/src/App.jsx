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

  // Focus sur la barre de recherche
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Obtenir la position GPS
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          setStartPoint(`Ma position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          setShowRouteInput(true);
        },
        (error) => {
          console.log('GPS désactivé:', error);
          alert('Activez la géolocalisation.');
        }
      );
    }
  };

  // Rechercher un lieu
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!search.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/search/places?q=${encodeURIComponent(search)}&limit=5`);
      const data = await response.json();
      
      if (data.success && data.results.length > 0) {
        setResults(data.results);
      } else {
        alert('Aucun résultat pour "' + search + '"');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  // Calculer un itinéraire
  const handleRouteCalculate = async () => {
    if (!startPoint.trim() || !endPoint.trim()) {
      alert('Saisissez départ et destination');
      return;
    }

    setLoading(true);
    try {
      // Géocoder le départ
      const startQuery = startPoint.includes('Ma position') ? 
        `${userLocation[1]},${userLocation[0]}` : startPoint;
      
      const startRes = await fetch(`/api/mapbox/geocoding?q=${encodeURIComponent(startQuery)}&limit=1`);
      const startData = await startRes.json();
      
      // Géocoder l'arrivée
      const endRes = await fetch(`/api/mapbox/geocoding?q=${encodeURIComponent(endPoint)}&limit=1`);
      const endData = await endRes.json();
      
      if (startData.results[0] && endData.results[0]) {
        const startCoord = startData.results[0].center;
        const endCoord = endData.results[0].center;
        
        // Calculer l'itinéraire
        const routeRes = await fetch(
          `/api/mapbox/directions?from=${startCoord.join(',')}&to=${endCoord.join(',')}`
        );
        const routeInfo = await routeRes.json();
        
        if (routeInfo.success) {
          setRouteData({
            start: startData.results[0],
            end: endData.results[0],
            route: routeInfo.route,
            geometry: routeInfo.route.geometry
          });
          
          // Retourner à la vue principale
          setShowRouteInput(false);
          setSearch('');
          setResults([]);
        }
      }
    } catch (error) {
      console.error('Erreur itinéraire:', error);
      alert('Erreur de calcul');
    } finally {
      setLoading(false);
    }
  };

  // Effacer l'itinéraire
  const clearRoute = () => {
    setRouteData(null);
    setStartPoint('');
    setEndPoint('');
    setShowRouteInput(false);
  };

  // Utiliser un résultat comme destination
  const useResultAsDestination = (result) => {
    setEndPoint(result.place_name);
    setShowRouteInput(true);
    setSearch('');
    setResults([]);
  };

  // Calculer un itinéraire rapide prédéfini
  const calculateQuickRoute = (fromName, toName, fromCoords, toCoords) => {
    setStartPoint(fromName);
    setEndPoint(toName);
    setShowRouteInput(true);
  };

  // Calculer la hauteur du header selon le contenu
  const headerHeight = () => {
    let height = 70; // Hauteur de base
    
    if (showRouteInput) {
      if (isMobile) {
        height += 160; // Mobile avec input
      } else {
        height += 130; // Desktop avec input
      }
    }
    
    return height;
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#1e293b',
      position: 'relative'
    }}>
      {/* Header responsive */}
      <div style={{
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.97)',
        backdropFilter: 'blur(10px)',
        padding: isMobile ? '12px' : '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '12px', 
          alignItems: isMobile ? 'stretch' : 'center',
          maxWidth: '1400px', 
          margin: '0 auto' 
        }}>
          {/* Logo et barre de recherche */}
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '8px' : '12px', 
            alignItems: 'center',
            flex: isMobile ? undefined : 1
          }}>
            {/* Logo */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              flexShrink: 0 
            }}>
              <div style={{
                width: isMobile ? '32px' : '36px',
                height: isMobile ? '32px' : '36px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isMobile ? '18px' : '20px'
              }}>
                🚌
              </div>
              {!isMobile && (
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: 'white'
                }}>
                  Gbaka Maps
                </span>
              )}
            </div>

            {/* Barre de recherche */}
            <form onSubmit={handleSearch} style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isMobile ? "Rechercher..." : "Rechercher un lieu à Abidjan..."}
                  style={{
                    flex: 1,
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    fontSize: isMobile ? '14px' : '15px',
                    color: 'white',
                    outline: 'none',
                    minWidth: '0'
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: 'white',
                    border: 'none',
                    padding: isMobile ? '10px' : '12px 20px',
                    borderRadius: '10px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: isMobile ? '14px' : '15px',
                    flexShrink: 0,
                    minWidth: isMobile ? '100%' : 'auto'
                  }}
                >
                  {loading ? '...' : isMobile ? '🔍 Rechercher' : '🔍'}
                </button>
              </div>
            </form>
          </div>

          {/* Boutons d'action */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            flexShrink: 0,
            justifyContent: isMobile ? 'space-between' : 'flex-end'
          }}>
            <button
              onClick={getLocation}
              style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: '10px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flex: isMobile ? 1 : undefined
              }}
              title="Ma position"
            >
              {isMobile ? '📍 Ma position' : '📍'}
            </button>
            
            <button
              onClick={() => setShowRouteInput(!showRouteInput)}
              style={{
                background: showRouteInput ? '#3b82f6' : 'rgba(59, 130, 246, 0.2)',
                color: showRouteInput ? 'white' : '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: isMobile ? '8px 12px' : '10px 16px',
                borderRadius: '10px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flex: isMobile ? 1 : undefined
              }}
              title="Calcul d'itinéraire"
            >
              {isMobile ? '🧭 Itinéraire' : '🧭'}
            </button>
            
            {routeData && (
              <button
                onClick={clearRoute}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: isMobile ? '8px 12px' : '10px 16px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: isMobile ? '13px' : '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flex: isMobile ? 1 : undefined
                }}
                title="Effacer l'itinéraire"
              >
                {isMobile ? '❌ Effacer' : '❌'}
              </button>
            )}
          </div>
        </div>

        {/* Input pour l'itinéraire */}
        {showRouteInput && (
          <div style={{ 
            marginTop: isMobile ? '12px' : '16px',
            padding: isMobile ? '12px' : '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Point de départ */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobile ? '8px' : '12px',
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <div style={{ 
                  color: '#10b981', 
                  fontSize: isMobile ? '18px' : '20px',
                  alignSelf: isMobile ? 'flex-start' : 'center'
                }}>
                  🚩
                </div>
                <input
                  type="text"
                  value={startPoint}
                  onChange={(e) => setStartPoint(e.target.value)}
                  placeholder="Point de départ..."
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '10px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: isMobile ? '14px' : '14px',
                    color: 'white',
                    outline: 'none'
                  }}
                />
              </div>
              
              {/* Destination */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobile ? '8px' : '12px',
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <div style={{ 
                  color: '#ef4444', 
                  fontSize: isMobile ? '18px' : '20px',
                  alignSelf: isMobile ? 'flex-start' : 'center'
                }}>
                  🏁
                </div>
                <input
                  type="text"
                  value={endPoint}
                  onChange={(e) => setEndPoint(e.target.value)}
                  placeholder="Destination..."
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: isMobile ? '10px 12px' : '10px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: isMobile ? '14px' : '14px',
                    color: 'white',
                    outline: 'none'
                  }}
                />
              </div>
              
              {/* Boutons d'action itinéraire */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '8px',
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <button
                  onClick={() => setShowRouteInput(false)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#94a3b8',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: isMobile ? '10px' : '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: isMobile ? '14px' : '14px',
                    width: isMobile ? '100%' : 'auto'
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleRouteCalculate}
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: 'white',
                    border: 'none',
                    padding: isMobile ? '12px' : '8px 24px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: isMobile ? '14px' : '14px',
                    width: isMobile ? '100%' : 'auto'
                  }}
                >
                  {loading ? 'Calcul en cours...' : 'Calculer l\'itinéraire'}
                </button>
              </div>

              {/* Itinéraires rapides (mobile seulement) */}
              {isMobile && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#94a3b8', 
                    marginBottom: '8px',
                    textAlign: 'center'
                  }}>
                    Itinéraires rapides :
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center'
                  }}>
                    <button
                      onClick={() => calculateQuickRoute('Yopougon', 'Plateau')}
                      style={{
                        background: 'rgba(249, 115, 22, 0.1)',
                        color: '#f97316',
                        border: '1px solid rgba(249, 115, 22, 0.3)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        flex: '1 0 auto',
                        minWidth: '80px'
                      }}
                    >
                      Yopougon → Plateau
                    </button>
                    <button
                      onClick={() => calculateQuickRoute('Cocody', 'Marcory')}
                      style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        flex: '1 0 auto',
                        minWidth: '80px'
                      }}
                    >
                      Cocody → Marcory
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Carte en plein écran */}
      <div style={{ 
        position: 'fixed',
        top: `${headerHeight()}px`,
        left: '0',
        right: '0',
        bottom: '0'
      }}>
        <MapComponent 
          gbakaPoints={gbakaPoints}
          userLocation={userLocation}
          searchResults={results}
          routeData={routeData}
          clearRoute={clearRoute}
        />
      </div>

      {/* Résultats de recherche flottants */}
      {results.length > 0 && !showRouteInput && (
        <div style={{
          position: 'fixed',
          top: `${headerHeight()}px`,
          left: isMobile ? '8px' : '20px',
          right: isMobile ? '8px' : '20px',
          maxHeight: isMobile ? '60vh' : '50vh',
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          overflowY: 'auto',
          zIndex: 999,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
        }}>
          <div style={{ padding: isMobile ? '12px' : '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{ 
                fontSize: isMobile ? '13px' : '14px', 
                color: '#94a3b8' 
              }}>
                {results.length} résultat{results.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setResults([])}
                style={{
                  background: 'transparent',
                  color: '#94a3b8',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: isMobile ? '13px' : '14px',
                  padding: '4px 8px'
                }}
              >
                ✕ Fermer
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {results.map((result, index) => (
                <div
                  key={index}
                  onClick={() => useResultAsDestination(result)}
                  style={{
                    padding: isMobile ? '10px' : '12px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: isMobile ? '8px' : '12px' 
                  }}>
                    <div style={{
                      width: isMobile ? '28px' : '32px',
                      height: isMobile ? '28px' : '32px',
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: isMobile ? '12px' : '14px',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: '600', 
                        color: 'white',
                        fontSize: isMobile ? '14px' : '15px',
                        marginBottom: '4px',
                        wordBreak: 'break-word'
                      }}>
                        {result.text}
                      </div>
                      <div style={{ 
                        fontSize: isMobile ? '12px' : '13px', 
                        color: '#94a3b8',
                        lineHeight: '1.4',
                        wordBreak: 'break-word'
                      }}>
                        {result.place_name}
                      </div>
                      <div style={{ 
                        marginTop: '8px',
                        fontSize: isMobile ? '11px' : '12px',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        📍 Cliquer pour utiliser comme destination
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info sur l'itinéraire actuel (mini-badge) */}
      {routeData && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? '10px' : '20px',
          left: isMobile ? '8px' : '20px',
          right: isMobile ? '8px' : '20px',
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(10px)',
          borderRadius: isMobile ? '10px' : '12px',
          padding: isMobile ? '12px' : '16px',
          border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 999,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? '12px' : '16px'
          }}>
            <div style={{ flex: 1 }}>
              {/* Départ */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: isMobile ? '6px' : '4px'
              }}>
                <div style={{ 
                  color: '#10b981',
                  fontSize: isMobile ? '16px' : '18px' 
                }}>🚩</div>
                <div style={{ 
                  fontSize: isMobile ? '13px' : '14px', 
                  color: 'white',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {routeData.start.text}
                </div>
              </div>
              
              {/* Arrivée */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: isMobile ? '8px' : '8px'
              }}>
                <div style={{ 
                  color: '#ef4444',
                  fontSize: isMobile ? '16px' : '18px' 
                }}>🏁</div>
                <div style={{ 
                  fontSize: isMobile ? '13px' : '14px', 
                  color: 'white',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {routeData.end.text}
                </div>
              </div>
              
              {/* Stats */}
              <div style={{ 
                display: 'flex', 
                gap: isMobile ? '12px' : '16px',
                fontSize: isMobile ? '12px' : '13px',
                color: '#94a3b8',
                justifyContent: isMobile ? 'space-between' : 'flex-start'
              }}>
                <span>📏 {(routeData.route.distance / 1000).toFixed(1)} km</span>
                <span>⏱️ {Math.round(routeData.route.duration / 60)} min</span>
              </div>
            </div>
            
            {/* Bouton Effacer */}
            <button
              onClick={clearRoute}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: isMobile ? '8px 12px' : '8px 16px',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: isMobile ? '13px' : '14px',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              {isMobile ? 'Effacer l\'itinéraire' : 'Effacer'}
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
          touch-action: pan-x pan-y;
        }
        
        ::placeholder {
          color: #94a3b8;
          opacity: 0.7;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Améliorations pour mobile */
        @media (max-width: 768px) {
          input, button {
            font-size: 16px !important; /* Évite le zoom iOS */
          }
          
          button {
            -webkit-tap-highlight-color: transparent;
            min-height: 44px; /* Taille minimale pour le touch */
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
        
        /* Supprime les outlines bleus sur iOS */
        input:focus, textarea:focus, select:focus {
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        
        /* Améliorations pour le texte */
        .text-truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}