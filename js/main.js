// Inicializar mapa centrado en una posición por defecto
const map = L.map('map', {zoomControl: false}).setView([40.4168, -3.7038], 13); // Madrid

/* Añadir control de zoom personalizado en otra posición
L.control.zoom({
  position: 'bottomright'
}).addTo(map); */

// Capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);


const ambulanceIcon = L.icon({
  iconUrl: './img/ambulance.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const hospitalIcon = L.icon({
  iconUrl: './img/hospital.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

// Variables globales
let ambulanceMarker;
let destinationMarker;

navigator.geolocation.watchPosition(pos => {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;

  if (ambulanceMarker) {
    ambulanceMarker.setLatLng([lat, lng]);
  } else {
    ambulanceMarker = L.marker([lat, lng], { icon: ambulanceIcon })
      .addTo(map)
      .bindPopup("Ubicación de la ambulancia.");
      //.openPopup();
  }

  // Cargar hospitales cercanos
  loadHospitals(lat, lng);

  map.setView([lat, lng], 16);
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
const routeInfoDiv = document.getElementById('route-info');

// Buscar destino y trazar ruta
searchInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (!query) return;

    // Geocodificar destino
    const geoRes = await fetch(`https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=1`);
    const geoData = await geoRes.json();

    if (!geoData.features || geoData.features.length === 0) {
      alert('Destino no encontrado');
      return;
    }

    const [lng, lat] = geoData.features[0].geometry.coordinates;

    // Dibujar marcador destino
    L.marker([lat, lng]).addTo(map)
      .bindPopup(`Destino: ${geoData.features[0].properties.label}`);
      //.openPopup();

    // Obtener coordenadas actuales
    const fromLatLng = ambulanceMarker.getLatLng();
    const from = [fromLatLng.lng, fromLatLng.lat];
    const to = [lng, lat];

    // Pedir ruta con instrucciones (incluye distancia y duración)
    const body = {
      coordinates: [from, to],
      instructions: true
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

    // Eliminar ruta anterior y dibujar la nueva
    if (routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.geoJSON(routeData, {
      style: {
        color: 'red',
        weight: 4
      }
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

    // EXTRAER distancia y duración y mostrarlos
    if (routeData && routeData.features && routeData.features.length > 0) {
      const summary = routeData.features[0].properties.summary;
      if(summary){
        const distanceKm = (summary.distance / 1000).toFixed(2);
        const durationFormatted = formatDuration(summary.duration);

        routeInfoDiv.style.display = 'block';
        routeInfoDiv.textContent = `${distanceKm} km | ${durationFormatted}`;

      } else {
        routeInfoDiv.style.display = 'none';
      }
    } else {
      routeInfoDiv.style.display = 'none';
    }

  }
});

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  if (h > 0) {
    return `${h} h ${m} min`;
  } else {
    return `${m} min`;
  }
};


// Al hacer clic route-info, comienza a iniciar la ruta
routeInfoDiv.addEventListener('click', () => {
  /*
  console.log("Iniciar ruta...");

  if (!routeLayer) {
    alert("No hay ruta disponible. Por favor, busca un destino primero.");
    return;
  }

  if (!ambulanceMarker) {
    alert("No se ha detectado la ubicación de la ambulancia.");
    return;
  }
  if (!destinationMarker) {
    alert("No se ha seleccionado un destino.");
    return;
  } */


});


async function loadHospitals(lat, lng) {
  const radius = 10000; // metros
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radius},${lat},${lng});
      way["amenity"="hospital"](around:${radius},${lat},${lng});
      relation["amenity"="hospital"](around:${radius},${lat},${lng});
    );
    out center;
  `;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);

  const res = await fetch(url);
  const data = await res.json();

  data.elements.forEach(el => {
    let latH, lngH, name;
    if(el.type === 'node'){
      latH = el.lat;
      lngH = el.lon;
    } else if (el.type === 'way' || el.type === 'relation'){
      latH = el.center.lat;
      lngH = el.center.lon;
    }
    name = el.tags.name || 'Hospital';

    // Crear contenido HTML para popup con botón
    const popupContent = `
      <strong>${name}</strong><br/>
      <button class="route-to-hospital-btn" data-lat="${latH}" data-lng="${lngH}">Ir a hospital</button>
    `;

    const marker = L.marker([latH, lngH], { icon: hospitalIcon }).addTo(map).bindPopup(popupContent);

    // Añadir listener para el botón cuando se abra el popup
    marker.on('popupopen', () => {
      const btn = document.querySelector('.route-to-hospital-btn');
      if (btn) {
        btn.addEventListener('click', async () => {
          if (!ambulanceMarker) {
            alert('No se ha detectado la ubicación de la ambulancia.');
            return;
          }

          const fromLatLng = ambulanceMarker.getLatLng();
          const from = [fromLatLng.lng, fromLatLng.lat];
          const to = [parseFloat(btn.dataset.lng), parseFloat(btn.dataset.lat)];

          // Construir la ruta con instrucciones
          const body = {
            coordinates: [from, to],
            instructions: true
          };

          try {
            const routeRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
              method: 'POST',
              headers: {
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(body)
            });
            const routeData = await routeRes.json();

            // Eliminar ruta anterior si existe
            if (routeLayer) map.removeLayer(routeLayer);

            routeLayer = L.geoJSON(routeData, {
              style: { color: 'red', weight: 4 }
            }).addTo(map);

            map.fitBounds(routeLayer.getBounds(), { padding: [30, 30] });

            // Mostrar info distancia y duración
            if (routeData.features && routeData.features.length > 0) {
              const summary = routeData.features[0].properties.summary;
              if (summary) {
                const distanceKm = (summary.distance / 1000).toFixed(2);
                const durationFormatted = formatDuration(summary.duration);

                routeInfoDiv.style.display = 'block';
                routeInfoDiv.textContent = `${distanceKm} km | ${durationFormatted}`;
              }
            }
          } catch (err) {
            console.error('Error generando ruta:', err);
            alert('Error generando la ruta. Inténtalo de nuevo.');
          }
        });
      }
    });
  });
}
