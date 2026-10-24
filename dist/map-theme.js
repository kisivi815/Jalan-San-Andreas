// Free vector basemap; edit map-style.json to customize individual map features.
async function initMapTheme(map) {
  const attribution = '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>';
  let layer, timer, settled = false;
  const badge = document.querySelector('.mapbadge');
  map.getContainer().dataset.mapTheme = 'loading';
  badge.innerHTML = '<i></i>正在加载 SAN ANDREAS 风格…';
  const fallback = (error) => {
    if (error) console.warn('Custom map could not load:', error.error || error);
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    map.attributionControl.removeAttribution(attribution);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);
    map.getContainer().dataset.mapTheme = 'standard';
    badge.innerHTML = '<i></i>风格地图暂不可用 · 标准地图';
  };
  try {
    // MapLibre GL JS 5 has no supported() export. Constructing the map
    // performs the WebGL check and throws if initialization is unavailable.
    if (typeof window.maplibregl?.Map !== 'function' || typeof L.maplibreGL !== 'function') {
      throw new Error('Map renderer did not load');
    }
    const response = await fetch('map-style.json?v=sa-5', { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Unable to load map style');
    const style = await response.json();
    layer = L.maplibreGL({ style, interactive: false }).addTo(map);
    map.attributionControl.addAttribution(attribution);
    const gl = layer.getMaplibreMap();
    // The Leaflet bridge keeps its initial container dimensions on resize.
    // Resize both renderers when navigation expands the mobile map.
    const resizeBasemap = () => {
      if (!map.hasLayer(layer)) return;
      const size = layer.getSize();
      const container = layer.getContainer();
      container.style.width = size.x + 'px';
      container.style.height = size.y + 'px';
      gl.resize();
    };
    map.on('resize', resizeBasemap);
    gl.on('remove', () => map.off('resize', resizeBasemap));
    timer = setTimeout(fallback, 20000);
    gl.once('load', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      map.getContainer().dataset.mapTheme = 'san-andreas';
      badge.innerHTML = '<i></i>SAN ANDREAS · 地图风格';
      initGtaPois(gl, map);
    });
    gl.on('error', fallback);
  } catch (error) {
    fallback(error);
  }
}
