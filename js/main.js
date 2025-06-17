// Inicializar mapa centrado en una posición por defecto
const map = L.map('map').setView([40.4168, -3.7038], 13); // Madrid

// Capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


const ambulanceIcon = L.icon({
  iconUrl: '../img/ambulance.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

let ambulanceMarker;

navigator.geolocation.watchPosition(pos => {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  if (ambulanceMarker) {
    ambulanceMarker.setLatLng([lat, lng]);
  } else {
    ambulanceMarker = L.marker([lat, lng], { icon: ambulanceIcon })
      .addTo(map)
      .bindPopup("Ubicación de la ambulancia")
      .openPopup();
  }

  map.setView([lat, lng], 15);
}, err => {
  alert("Error accediendo a tu ubicación");
  console.error(err);
}, {
  enableHighAccuracy: true
});


// API
const ORS_API_KEY = '5b3ce3597851110001cf6248265e113355044fd592880d3f6f3f0b6b';
const searchInput = document.getElementById('search');
let routeLayer;

// Buscar destino y trazar ruta
searchInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (!query) return;

    // Paso 1: Geocodificación del destino
    const geoRes = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=1`);
    const geoData = await geoRes.json();

    if (!geoData.features || geoData.features.length === 0) {
      alert('Destino no encontrado');
      return;
    }

    const [lng, lat] = geoData.features[0].geometry.coordinates;

    // Paso 2: Dibujar marcador destino
    L.marker([lat, lng]).addTo(map)
      .bindPopup(`Destino: ${geoData.features[0].properties.label}`)
      .openPopup();

    // Paso 3: Obtener coordenadas actuales
    const fromLatLng = ambulanceMarker.getLatLng();
    const from = [fromLatLng.lng, fromLatLng.lat]; // orden [lng, lat]
    const to = [lng, lat];

    // Paso 4: Solicitar ruta
    const body = {
      coordinates: [from, to],
      instructions: false
    };

    const routeRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const routeData = await routeRes.json();

    // Paso 5: Dibujar ruta en el mapa
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.geoJSON(routeData, {
      style: {
        color: 'red',
        weight: 4
      }
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });
  }
});
