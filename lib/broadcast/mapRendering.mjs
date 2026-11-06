// Simplify display geometry only; source boundaries remain unchanged.
// 0.00008 degrees is under nine metres north/south, below a pixel at our maximum zoom.
export function simplifyBoundaries(geo, tolerance = .00008) {
  function ring(points) {
    if (points.length <= 4) return points;
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [start, end] = stack.pop();
      const [ax, ay] = points[start], [bx, by] = points[end];
      const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
      let best = tolerance * tolerance, index = -1;
      for (let i = start + 1; i < end; i++) {
        const [x, y] = points[i];
        const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
        const distance = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
        if (distance > best) { best = distance; index = i; }
      }
      if (index !== -1) { keep[index] = 1; stack.push([start, index], [index, end]); }
    }
    const result = points.filter((_, index) => keep[index]);
    return result.length >= 4 ? result : points;
  }
  return { ...geo, features: geo.features.map(feature => ({ ...feature, geometry: {
    ...feature.geometry,
    coordinates: feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates.map(polygon => polygon.map(ring))
      : feature.geometry.type === "Polygon" ? feature.geometry.coordinates.map(ring) : feature.geometry.coordinates,
  } })) };
}

// Public Leaflet methods only. Each frame projects fresh vector geometry rather
// than scaling a cached drawing for the entire flight.
export function animateMapView(map, bounds, framing, scheduler, isCurrent, duration = 1200) {
  const initialCenter = map.getCenter(), initialZoom = map.getZoom();
  map.fitBounds(bounds, { ...framing, animate: false });
  const targetCenter = map.getCenter(), targetZoom = map.getZoom();
  map.setView(initialCenter, initialZoom, { animate: false });
  const startPoint = map.project(initialCenter, 0), endPoint = map.project(targetCenter, 0);
  let started, frame, cancelled = false;
  function step(time) {
    if (cancelled || !isCurrent()) return;
    started ??= time;
    const progress = Math.min(1, (time - started) / duration);
    const eased = progress * progress * (3 - 2 * progress);
    const center = map.unproject([startPoint.x + (endPoint.x - startPoint.x) * eased, startPoint.y + (endPoint.y - startPoint.y) * eased], 0);
    map.setView(center, initialZoom + (targetZoom - initialZoom) * eased, { animate: false });
    if (progress < 1) frame = scheduler.requestAnimationFrame(step);
  }
  frame = scheduler.requestAnimationFrame(step);
  return () => { cancelled = true; scheduler.cancelAnimationFrame(frame); };
}
