// Free vector basemap; edit map-style.json to customize individual map features.
async function initMapTheme(map) {
  const attribution = '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
  let layer, timer, settled = false;
  const fallback = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    map.attributionControl.removeAttribution(attribution);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);
    document.querySelector('.mapbadge').innerHTML = '<i></i>风格地图暂不可用 · 标准地图';
  };
  try {
    if (!window.maplibregl?.supported() || !L.maplibreGL) return fallback();
    const response = await fetch('map-style.json', { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Unable to load map style');
    const style = await response.json();
    layer = L.maplibreGL({ style, interactive: false }).addTo(map);
    map.attributionControl.addAttribution(attribution);
    const gl = layer.getMaplibreMap();
    timer = setTimeout(fallback, 20000);
    gl.once('load', () => { settled = true; clearTimeout(timer); });
    gl.on('error', fallback);
  } catch {
    fallback();
  }
}
