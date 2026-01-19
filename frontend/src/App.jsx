import React, { useState, useEffect } from 'react';

export default function App() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [gbakaPoints, setGbakaPoints] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  // Charger les points Gbaka
  useEffect(() => {
    fetch('/api/gbaka/points')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGbakaPoints(data.points);
          console.log('Points chargés:', data.points);
        }
      });
  }, []);

  // Obtenir la position GPS
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          setUserLocation([longitude, latitude]);
          alert(`Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        (error) => {
          console.log('GPS désactivé:', error);
          alert('Activez la géolocalisation');
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
      const response = await fetch(`/api/mapbox/geocoding?q=${encodeURIComponent(search)}`);
      const data = await response.json();
      
      if (data.success && data.results.length > 0) {
        setResults(data.results);
        alert(`Trouvé: ${data.results[0].place_name}`);
      } else {
        alert('Aucun résultat trouvé');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur de recherche');
    } finally {
      setLoading(false);
    }
  };

  // Calculer un itinéraire
  const calculateRoute = async (from, to) => {
    try {
      const response = await fetch(`/api/mapbox/directions?from=${from}&to=${to}`);
      const data = await response.json();
      
      if (data.success) {
        const route = data.route;
        alert(`Itinéraire: ${route.distance / 1000} km, ${Math.round(route.duration / 60)} min`);
      }
    } catch (error) {
      console.error('Erreur itinéraire:', error);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '20px',
      color: 'white'
    }}>
      
      {/* Header */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px'
            }}>
              🚌
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
                Gbaka Guides
              </h1>
              <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                Backend connecté ✅
              </p>
            </div>
          </div>
          
          <button
            onClick={getLocation}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>📍</span>
            Ma position
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <form onSubmit={handleSearch}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lieu (Yopougon, Plateau, Cocody...)"
              style={{
                flex: 1,
                padding: '16px 20px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '2px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                fontSize: '16px',
                color: 'white',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '16px',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Recherche...' : '🔍 Rechercher'}
            </button>
          </div>
        </form>
      </div>

      {/* Points Gbaka */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>
          🚌 Points Gbaka (via backend)
        </h2>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {gbakaPoints.map(point => (
            <div
              key={point.id}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                borderLeft: `4px solid ${point.color}`,
                cursor: 'pointer',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              onClick={() => alert(`${point.name}\n${point.description}\nPrix: ${point.price} FCFA`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: point.color,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  {point.icon}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                    {point.name}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
                    {point.type === 'gbaka' ? 'Gare Gbaka' : 'Taxi partagé'}
                  </p>
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>
                  {point.frequency}
                </div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: point.color }}>
                  {point.price} FCFA
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Résultats de recherche */}
      {results.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>
            🔍 Résultats de recherche
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map((result, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onClick={() => {
                  const [lng, lat] = result.center;
                  alert(`📍 ${result.place_name}\n\nCoordonnées: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }}
              >
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  {result.text}
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                  {result.place_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Itinéraire rapide */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>
          🧭 Itinéraire rapide
        </h2>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => calculateRoute('-4.065,5.335', '-4.025,5.325')}
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              color: 'white',
              border: 'none',
              padding: '16px 24px',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '16px',
              flex: 1,
              minWidth: '200px'
            }}
          >
            Yopougon → Plateau
          </button>
          
          <button
            onClick={() => calculateRoute('-4.055,5.345', '-4.035,5.315')}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white',
              border: 'none',
              padding: '16px 24px',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '16px',
              flex: 1,
              minWidth: '200px'
            }}
          >
            Cocody → Marcory
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: '14px'
      }}>
        <p style={{ margin: 0 }}>
          Gbaka Guides v1.0 • Backend: localhost:3001 • Mapbox via proxy
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          Testez: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>curl http://localhost:3001/api/health</code>
        </p>
      </div>
    </div>
  );
}