# World Explorer Map

Responsive website with a global map. Users can tap/click anywhere to retrieve location information such as country, city/town, and exact coordinates.

## Features

- Interactive global map powered by Leaflet + OpenStreetMap tiles
- Reverse geocoding on map click/tap for place details
- Place search to jump quickly to any destination
- "Use my location" button with browser geolocation
- Save up to 10 favorite places in local browser storage
- Dark/light theme toggle persisted in local storage
- Mobile-first responsive layout that adapts for phones and desktops

## Run locally

Because this is a static website, you can open `index.html` directly, or run a simple local server:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.
