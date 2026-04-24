const map = L.map('map', { minZoom: 2 }).setView([20, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const details = document.getElementById('details');
const form = document.getElementById('searchForm');
const searchInput = document.getElementById('placeSearch');
const locateBtn = document.getElementById('locateBtn');
const saveBtn = document.getElementById('saveBtn');
const savedPlacesList = document.getElementById('savedPlacesList');
const themeToggle = document.getElementById('themeToggle');

const SAVED_PLACES_KEY = 'world-explorer-saved-places-v1';
const THEME_KEY = 'world-explorer-theme';

let activeMarker = null;
let currentPlace = null;

function setDetailsLoading(message = 'Loading place details...') {
  details.innerHTML = `
    <h2>Place details</h2>
    <p class="hint">${message}</p>
  `;
}

function setDetailsError(message) {
  details.innerHTML = `
    <h2>Place details</h2>
    <p class="hint">${message}</p>
  `;
}

function updateMarker(lat, lng, title) {
  if (activeMarker) {
    activeMarker.setLatLng([lat, lng]);
  } else {
    activeMarker = L.marker([lat, lng]).addTo(map);
  }

  if (title) {
    activeMarker.bindPopup(title).openPopup();
  }
}

function formatValue(value, fallback = 'Unknown') {
  return value && String(value).trim() ? value : fallback;
}

function getCountryFlagEmoji(countryCode = '') {
  const normalized = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return '🌍';
  }

  return String.fromCodePoint(
    normalized.charCodeAt(0) + 127397,
    normalized.charCodeAt(1) + 127397
  );
}

function mapsDeepLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function renderPlaceDetails(data, lat, lng) {
  const address = data.address || {};
  const displayName = formatValue(data.display_name);
  const countryCode = formatValue(address.country_code, '').toUpperCase();

  currentPlace = {
    name: displayName,
    lat,
    lng,
    country: formatValue(address.country),
    region: formatValue(address.state || address.region),
    locality: formatValue(
      address.city || address.town || address.village || address.county
    ),
    countryCode,
    source: 'nominatim'
  };

  details.innerHTML = `
    <h2>${getCountryFlagEmoji(countryCode)} ${displayName}</h2>
    <dl>
      <dt>Country</dt>
      <dd>${currentPlace.country}</dd>

      <dt>Region / State</dt>
      <dd>${currentPlace.region}</dd>

      <dt>City / Town</dt>
      <dd>${currentPlace.locality}</dd>

      <dt>Latitude</dt>
      <dd>${lat.toFixed(5)}</dd>

      <dt>Longitude</dt>
      <dd>${lng.toFixed(5)}</dd>

      <dt>Open in Maps</dt>
      <dd><a class="place-link" href="${mapsDeepLink(lat, lng)}" target="_blank" rel="noreferrer">Open location</a></dd>
    </dl>
    <p class="meta">Data source: OpenStreetMap Nominatim.</p>
  `;

  details.focus();
}

function readSavedPlaces() {
  try {
    const raw = localStorage.getItem(SAVED_PLACES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedPlaces(items) {
  localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(items));
}

function renderSavedPlaces() {
  const saved = readSavedPlaces();
  if (saved.length === 0) {
    savedPlacesList.innerHTML = '<li class="hint">No saved places yet.</li>';
    return;
  }

  savedPlacesList.innerHTML = saved
    .map(
      (place, index) => `
        <li>
          <button type="button" class="ghost-btn" data-index="${index}">
            ${getCountryFlagEmoji(place.countryCode)} ${place.name}
          </button>
        </li>
      `
    )
    .join('');
}

function saveCurrentPlace() {
  if (!currentPlace) {
    setDetailsError('Select a place first before saving it.');
    return;
  }

  const saved = readSavedPlaces();
  const duplicate = saved.find(
    (item) => item.name === currentPlace.name && item.lat === currentPlace.lat && item.lng === currentPlace.lng
  );

  if (duplicate) {
    setDetailsError('This place is already saved.');
    return;
  }

  saved.unshift(currentPlace);
  writeSavedPlaces(saved.slice(0, 10));
  renderSavedPlaces();
}

function flyToPlace(place) {
  map.setView([place.lat, place.lng], 7, { animate: true });
  updateMarker(place.lat, place.lng, place.name);

  renderPlaceDetails(
    {
      display_name: place.name,
      address: {
        country: place.country,
        state: place.region,
        city: place.locality,
        country_code: place.countryCode
      }
    },
    place.lat,
    place.lng
  );
}

async function reverseGeocode(lat, lng) {
  setDetailsLoading();

  try {
    const endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    renderPlaceDetails(data, lat, lng);
    updateMarker(lat, lng, data.display_name);
  } catch (error) {
    setDetailsError(
      'Could not load place details right now. Please try again in a moment.'
    );
    console.error(error);
  }
}

async function searchPlace(query) {
  setDetailsLoading(`Searching for “${query}”...`);

  try {
    const endpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(
      query
    )}`;
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      setDetailsError('No matching place found. Try another search term.');
      return;
    }

    const best = results[0];
    const lat = Number(best.lat);
    const lng = Number(best.lon);

    map.setView([lat, lng], 7, { animate: true });
    renderPlaceDetails(best, lat, lng);
    updateMarker(lat, lng, best.display_name);
  } catch (error) {
    setDetailsError('Search failed. Please check your connection and retry.');
    console.error(error);
  }
}

function applySavedTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === 'dark') {
    document.body.classList.add('dark');
  }
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, theme);
});

map.on('click', (event) => {
  const { lat, lng } = event.latlng;
  reverseGeocode(lat, lng);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    setDetailsError('Enter a place name first (for example: Nairobi).');
    searchInput.focus();
    return;
  }

  searchPlace(query);
});

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    setDetailsError('Geolocation is not supported by your browser.');
    return;
  }

  setDetailsLoading('Detecting your location...');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.setView([lat, lng], 8, { animate: true });
      reverseGeocode(lat, lng);
    },
    () => {
      setDetailsError(
        'Location access was denied or unavailable. Please use map click instead.'
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 12000
    }
  );
});

saveBtn.addEventListener('click', saveCurrentPlace);

savedPlacesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-index]');
  if (!button) return;

  const saved = readSavedPlaces();
  const index = Number(button.dataset.index);
  if (Number.isNaN(index) || !saved[index]) return;

  flyToPlace(saved[index]);
});

applySavedTheme();
renderSavedPlaces();
