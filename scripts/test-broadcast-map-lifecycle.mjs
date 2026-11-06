import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { animateMapView, simplifyBoundaries } from "../lib/broadcast/mapRendering.mjs";

// Exercise effect ownership without needing a browser or map tiles.
const source = fs.readFileSync("components/broadcast/assembly/ConstituencyMap.jsx", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
function harness() {
  const hooks = [], effects = [], maps = [], pending = [], timers = [], animationFrames = [];
  const bounds = { getCenter: () => ({ x: 200, y: 250 }), getNorthEast: () => ({ x: 240, y: 200 }), getSouthWest: () => ({ x: 160, y: 300 }) };
  let cursor = 0, layerAdds = 0;
  const react = {
    memo: component => component,
    useRef(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
    useState(value) { const i = cursor++; if (!(i in hooks)) hooks[i] = value; return [hooks[i], next => { hooks[i] = next; }]; },
    useEffect(effect) { effects.push(effect); },
  };
  const leaflet = {
    map() {
      const map = { removed: false, stops: 0, views: 0, center: { x: 0, y: 0 }, zoom: 7,
        stop() { assert.ok(!this.removed, "stop must never run on a removed map"); this.stops++; },
        remove() { assert.ok(!this.removed); this.removed = true; },
        fitBounds() { assert.ok(!this.removed); this.center = { x: 200, y: 250 }; this.zoom = 11; },
        getCenter() { return this.center; }, getZoom() { return this.zoom; },
        setView(center, zoom, options) { assert.ok(!this.removed); assert.equal(options.animate, false); this.center = center; this.zoom = zoom; this.views++; },
        project(point) { return point; }, unproject([x, y]) { return { x, y }; },
        invalidateSize() {}, latLngToContainerPoint(point) { return point; },
      };
      maps.push(map); return map;
    },
    geoJSON() {
      return { addTo(map) { assert.ok(!map.removed, "Late fetch must not attach to removed map"); layerAdds++; return this; }, getBounds() { return bounds; }, eachLayer(callback) { callback({ feature: { properties: { ENG_NAME_VALUE: "Belfast East" } }, setStyle() {}, bringToFront() {}, getBounds() { return bounds; } }); } };
    },
  };
  const sandbox = {
    exports: {}, AbortController,
    window: { matchMedia: () => ({ matches: false }), setTimeout(callback) { const timer = { callback, cancelled: false }; timers.push(timer); return timer; }, clearTimeout(timer) { if (timer) timer.cancelled = true; }, requestAnimationFrame(callback) { const frame = { callback, cancelled: false }; animationFrames.push(frame); return frame; }, cancelAnimationFrame(frame) { if (frame) frame.cancelled = true; } },
    fetch: () => new Promise(resolve => pending.push(resolve)),
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
      if (name === "leaflet") return leaflet;
      if (name === "./OutlinedText") return { outlineBroadcastText: node => node };
      if (name.includes("mapRendering")) return { animateMapView, simplifyBoundaries };
      return {};
    },
  };
  vm.runInNewContext(compiled.outputText, sandbox);
  function render(focus = false) { cursor = 0; effects.length = 0; sandbox.exports.default({ name: "Belfast East", focus }); return [...effects]; }
  async function resolveFetch() { pending.shift()({ ok: true, json: async () => ({ features: [] }) }); for (let i = 0; i < 8; i++) await Promise.resolve(); }
  function runTimers() { for (const timer of timers.splice(0)) if (!timer.cancelled) timer.callback(); }
  function runFrames() { for (let time = 0; animationFrames.length && time < 3000; time += 50) { for (const frame of animationFrames.splice(0)) if (!frame.cancelled) frame.callback(time); } }
  return { render, resolveFetch, runTimers, runFrames, maps, get layerAdds() { return layerAdds; } };
}
const loaded = harness();
const removeMap = loaded.render()[0]();
await loaded.resolveFetch();
const stopFlight = loaded.render(true)[1]();
assert.equal(typeof stopFlight, "function");
removeMap();
assert.doesNotThrow(stopFlight, "Unmount cleanup remains safe after map removal");
assert.doesNotThrow(loaded.runTimers, "Unmount cancels delayed locator zoom");
assert.equal(loaded.maps[0].views, 0);

const locator = harness();
const removeLocator = locator.render()[0]();
await locator.resolveFetch();
const stopLocator = locator.render(true)[1]();
assert.equal(locator.maps[0].views, 0, "Locator draws before zoom begins");
locator.runTimers();
locator.runFrames();
assert.ok(locator.maps[0].views > 20, "Camera redraws vectors throughout the faster zoom");
assert.equal(locator.maps[0].zoom, 11);
stopLocator(); removeLocator();

const changing = harness();
const removeChanging = changing.render()[0]();
await changing.resolveFetch();
const stopOldView = changing.render()[1]();
stopOldView();
assert.equal(changing.maps[0].stops, 2, "Changing focus stops the still-live map animation");
const stopNewView = changing.render(true)[1]();
stopNewView(); removeChanging();

const stale = harness();
const oldEffects = stale.render();
const removeOld = oldEffects[0](); removeOld();
const removeNew = stale.render()[0]();
await stale.resolveFetch();
assert.equal(stale.layerAdds, 0, "Old request is ignored after remount");
await stale.resolveFetch();
assert.equal(stale.layerAdds, 1, "New map owns its boundary response");
removeNew();
const geometry = JSON.parse(fs.readFileSync("public/data/elections/northern-ireland/assembly/2022/boundaries.geojson", "utf8"));
const simplified = simplifyBoundaries(geometry);
let originalPoints = 0, simplifiedPoints = 0;
for (let i = 0; i < geometry.features.length; i++) {
  const original = geometry.features[i], display = simplified.features[i];
  assert.deepEqual(display.properties, original.properties);
  const rings = g => g.type === "MultiPolygon" ? g.coordinates.flat() : g.coordinates;
  originalPoints += rings(original.geometry).reduce((sum, ring) => sum + ring.length, 0);
  for (const ring of rings(display.geometry)) {
    simplifiedPoints += ring.length;
    assert.ok(ring.length >= 4);
    assert.deepEqual(ring[0], ring[ring.length - 1], "Display polygons stay closed");
  }
}
assert.ok(simplifiedPoints < originalPoints / 2, "Display simplification substantially reduces rendering work");
const cameraFrames = [], views = [];
const camera = {
  center: { x: 0, y: 0 }, zoom: 5,
  getCenter() { return this.center; }, getZoom() { return this.zoom; },
  fitBounds() { this.center = { x: 100, y: 200 }; this.zoom = 9; },
  setView(center, zoom) { this.center = center; this.zoom = zoom; views.push(zoom); },
  project(point) { return point; }, unproject([x, y]) { return { x, y }; },
};
const scheduler = { requestAnimationFrame(callback) { cameraFrames.push(callback); return callback; }, cancelAnimationFrame(callback) { const i = cameraFrames.indexOf(callback); if (i >= 0) cameraFrames.splice(i, 1); } };
const cancelCamera = animateMapView(camera, {}, {}, scheduler, () => true);
for (let time = 0; cameraFrames.length; time += 100) cameraFrames.shift()(time);
assert.equal(camera.zoom, 9);
assert.deepEqual(camera.center, { x: 100, y: 200 });
assert.ok(views.some(zoom => zoom > 5 && zoom < 9 && !Number.isInteger(zoom)), "Camera interpolates fractional zoom rather than snapping");
assert.ok(views.every((zoom, i) => i === 0 || zoom >= views[i - 1]), "Camera follows a monotonic zoom path");
cancelCamera();
const cancelPendingCamera = animateMapView(camera, {}, {}, scheduler, () => true);
cancelPendingCamera();
assert.equal(cameraFrames.length, 0, "Animation cancellation clears the queued redraw");
console.log(`Boundary rendering: ${originalPoints.toLocaleString()} source points → ${simplifiedPoints.toLocaleString()} display points; source preserved.`);
console.log("Map lifecycle passed: unmount cleanup, focus changes, remount and stale fetch responses.");
