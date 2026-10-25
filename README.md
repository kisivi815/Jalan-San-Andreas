# Jalan

A mobile-friendly map and foreground GPS navigation website with a GTA San Andreas inspired map style.

## Features

- Destination search and driving route alternatives
- Current location and live GPS tracking
- Turn instructions, browser speech, remaining distance and estimated arrival
- Direction checks and automatic rerouting after confirmed deviation
- Road and place labels, original GTA map icons, and POI category filters

## Run locally

No build step or dependency installation is required. From the project directory:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open http://localhost:8765. Geolocation requires localhost or HTTPS and browser permission. Keep the page in the foreground for navigation.

## Tests

Node.js 24 or later:

```sh
node --test tests/*.test.cjs
```

## Project structure

- `dist/index.html`: page layout and styles
- `dist/app.js`: search and route selection
- `dist/map-style.json`: vector map colors and labels
- `dist/map-theme.js`: Leaflet / MapLibre basemap integration
- `dist/gta-pois.js`: POI icons and categories
- `dist/nav-core.js`: route geometry and maneuver calculations
- `dist/navigation.js`: live GPS navigation controller
- `dist/road-routing.js`: driving route requests
- `tests/`: automated checks
- `.openai/hosting.json`: existing Sites deployment identity

## Data and limitations

The website uses OpenFreeMap / OpenStreetMap, Nominatim, OSRM, Leaflet, and MapLibre. Internet access is required. Route quality depends on road data; missing one-way or access restrictions can lead to unsuitable routes. This project does not include live traffic or guaranteed background navigation.

GTA icon provenance and artwork ownership are documented in `dist/assets/gta/SOURCE.md`. No rights to third-party artwork are granted by this repository.

## Hosting

Serve `dist/` with a static HTTPS host. The existing Sites deployment is configured separately by `.openai/hosting.json`.
