"use client";

import { memo, useEffect, useRef, useState } from "react";
import { animateMapView, simplifyBoundaries } from "@/lib/broadcast/mapRendering.mjs";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./assembly.module.css";

function ConstituencyMap({ name, focus }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [locator, setLocator] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setReady(false);
    const map = L.map(container.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, zoomSnap: 0, zoomAnimation: false, preferCanvas: false });
    mapRef.current = map;
    fetch("/data/elections/northern-ireland/assembly/2022/boundaries.geojson", { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(geo => {
        if (controller.signal.aborted || mapRef.current !== map) return;
        const layers = L.geoJSON(simplifyBoundaries(geo), { interactive: false, style: { color: "#8197a8", weight: 1.2, fillColor: "#253f50", fillOpacity: 1 } }).addTo(map);
        layersRef.current = layers;
        map.fitBounds(layers.getBounds(), { paddingTopLeft: [80, 90], paddingBottomRight: [1040, 300], animate: false });
        setReady(true);
      }).catch(reason => { if (!controller.signal.aborted && mapRef.current === map && reason.name !== "AbortError") setError("Map unavailable"); });
    return () => {
      controller.abort();
      // Invalidate ownership before removal: later effect cleanups must not use this map.
      if (mapRef.current === map) {
        mapRef.current = null;
        layersRef.current = null;
      }
      map.remove();
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current, layers = layersRef.current;
    if (!ready || !map || !layers) return;
    map.stop();
    map.invalidateSize({ animate: false });
    let selected;
    layers.eachLayer(layer => {
      const match = layer.feature.properties.ENG_NAME_VALUE === name;
      layer.setStyle({ fillColor: match ? "#67d4ce" : "#253f50", color: match ? "#e3fffc" : "#8197a8", weight: match ? 2.5 : 1.2 });
      if (match) selected = layer;
    });
    if (selected) selected.bringToFront();
    const bounds = focus && selected ? selected.getBounds() : layers.getBounds();
    const animate = focus && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const framing = { paddingTopLeft: [80, 90], paddingBottomRight: [1040, 300], maxZoom: 11.5 };
    let zoomTimer;
    let cancelZoom;
    if (animate && selected) {
      const center = map.latLngToContainerPoint(bounds.getCenter());
      const ne = map.latLngToContainerPoint(bounds.getNorthEast());
      const sw = map.latLngToContainerPoint(bounds.getSouthWest());
      setLocator({ x: center.x, y: center.y, radius: Math.max(38, Math.hypot(ne.x - sw.x, ne.y - sw.y) / 2 + 14) });
      zoomTimer = window.setTimeout(() => {
        if (mapRef.current !== map) return;
        setLocator(null);
        cancelZoom = animateMapView(map, bounds, framing, window, () => mapRef.current === map);
      }, 650);
    } else {
      setLocator(null);
      map.fitBounds(bounds, { ...framing, animate: false });
    }
    return () => { window.clearTimeout(zoomTimer); cancelZoom?.(); if (mapRef.current === map) map.stop(); };
  }, [ready, name, focus]);
  return <div className={styles.coverageMapFrame}><div ref={container} className={styles.coverageMap} aria-label={`Constituency map: ${name}`} />{locator && <svg className={styles.mapLocator} aria-hidden="true"><circle cx={locator.x} cy={locator.y} r={locator.radius} pathLength="1" /></svg>}<span className={styles.mapCaption}>{error || (focus ? name : "Northern Ireland · 18 constituencies")}</span></div>;
}
export default memo(ConstituencyMap);
