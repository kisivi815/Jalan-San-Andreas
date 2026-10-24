const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(new URL('../dist/map-theme.js', `file://${__filename}`), 'utf8');

async function setup(renderer, failure = false) {
  const container = { dataset: {} }, badge = {}, events = {};
  let vectorCount = 0, rasterCount = 0;
  const map = {
    getContainer: () => container,
    hasLayer: () => true,
    removeLayer() {},
    attributionControl: { addAttribution() {}, removeAttribution() {} }
  };
  const context = {
    window: { maplibregl: renderer },
    document: { querySelector: () => badge },
    L: {
      maplibreGL() {
        if (failure) throw new Error('WebGL unavailable');
        vectorCount++;
        return { addTo() { return this; }, getMaplibreMap: () => ({ once: (e, f) => events[e] = f, on: (e, f) => events[e] = f }) };
      },
      tileLayer: () => ({ addTo() { rasterCount++; } })
    },
    fetch: async () => ({ ok: true, json: async () => ({ version: 8 }) }),
    AbortSignal, setTimeout: () => 1, clearTimeout() {}, console: { warn() {} }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  await context.initMapTheme(map);
  return { container, badge, events, vectorCount, rasterCount };
}

test('MapLibre 5 API without supported() still starts custom renderer', async () => {
  const r = await setup({ Map: function Map() {} });
  assert.equal(r.vectorCount, 1);
  assert.equal(r.rasterCount, 0);
  r.events.load();
  assert.equal(r.container.dataset.mapTheme, 'san-andreas');
  assert.match(r.badge.innerHTML, /SAN ANDREAS/);
});

test('missing renderer or unavailable WebGL falls back visibly', async () => {
  for (const r of [await setup(undefined), await setup({ Map() {} }, true)]) {
    assert.equal(r.rasterCount, 1);
    assert.equal(r.container.dataset.mapTheme, 'standard');
    assert.match(r.badge.innerHTML, /标准地图/);
  }
});
