import GeoMapModal from './GeoMapModal';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { divIcon, DomEvent } from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { scheduleVisualWork } from './scheduleVisualWork';

const color = (price) => price >= 5 ? '#C2410C' : price >= 2 ? '#64748B' : '#0F172A';
const GURGAON_CENTER = [28.4595, 77.0266];
const DEFAULT_ZOOM = 11;

function closeMapOverlays(map) {
  map.closePopup();
  // Map.closeTooltip requires a tooltip argument; bound layers safely close
  // their own tooltips, including whichever marker was last hovered.
  map.eachLayer((layer) => { if (layer.getTooltip?.()) layer.closeTooltip(); });
}

function MapNavigation({ active, onReset }) {
  const [moved, setMoved] = useState(false);
  const buttonRef = useRef(null);
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      setMoved(map.getZoom() !== DEFAULT_ZOOM || Math.abs(center.lat - GURGAON_CENTER[0]) > .00001 || Math.abs(center.lng - GURGAON_CENTER[1]) > .00001);
    },
  });
  useEffect(() => {
    return scheduleVisualWork(() => map.invalidateSize({ animate: false }));
  }, [map]);
  const visible = Boolean(active || moved);
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    DomEvent.disableClickPropagation(button); DomEvent.disableScrollPropagation(button);
    return () => { DomEvent.off(button); };
  }, [visible]);
  if (!visible) return null;
  return <button ref={buttonRef} type="button" className="map-reset-button map-primary-action" aria-label="Reset map view to Gurgaon"
    onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.stopPropagation();
      onReset(); setMoved(false);
    }}>← Reset View</button>;
}

function MapLifecycle({ mapRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => { closeMapOverlays(map); mapRef.current = null; };
  }, [map, mapRef]);
  return null;
}

function GeoMap({ data, onOpenSectorInsights }) {
  const [tileFailed, setTileFailed] = useState(false);
  const [activeSector, setActiveSector] = useState(null);
  const [hoveredSector, setHoveredSector] = useState(null);
  const mapRef = useRef(null);
  const activeRow = data.sectors.find((item) => item.sector === activeSector);
  const handleCloseModal = useCallback(() => {
    setActiveSector(null); setHoveredSector(null);
    const map = mapRef.current;
    if (map) {
      map.stop(); closeMapOverlays(map);
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      map.flyTo(GURGAON_CENTER, DEFAULT_ZOOM, { animate: !reducedMotion, duration: .65 });
    }
    // DetailModal's shared lock releases body scrolling when the last dialog exits.
  }, []);
  useEffect(() => {
    if (activeSector && !activeRow) handleCloseModal();
  }, [activeSector, activeRow, handleCloseModal]);
  const pins = useMemo(() => {
    const colocated = new Map();
    data.sectors.forEach((sector) => {
      const key = `${sector.latitude}:${sector.longitude}`;
      if (!colocated.has(key)) colocated.set(key, []);
      colocated.get(key).push(sector.sector);
    });
    return data.sectors.map((sector) => {
      const group = colocated.get(`${sector.latitude}:${sector.longitude}`);
      const index = group.indexOf(sector.sector);
      // Spread shared reference icons in screen pixels; geographic coordinates
      // remain unchanged and the shared-reference behavior is disclosed below.
      const x = group.length > 1 ? Math.cos(index * 2 * Math.PI / group.length) * 38 : 0;
      const y = group.length > 1 ? Math.sin(index * 2 * Math.PI / group.length) * 32 : 0;
      const price = Number(sector.median_price_cr).toLocaleString('en-IN', { maximumFractionDigits: 4 });
      const icon = divIcon({ className: 'sector-price-marker',
        html: `<span style="background:${color(sector.median_price_cr)};${sector.resolution === 'city_fallback' ? 'border-style:dashed;' : ''}">₹${price}</span>`,
        iconSize: [66, 27], iconAnchor: [33 - x, 13 - y], popupAnchor: [x, y - 12], tooltipAnchor: [x, y - 12] });
      return { sector, icon, price };
    });
  }, [data.sectors]);
  return <div>
    <div className="geo-map-frame" role="region" aria-label="Gurgaon sector price map">
      <MapContainer center={GURGAON_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom={false} className="gurgaon-map" aria-label="Gurgaon sector price map">
        <MapLifecycle mapRef={mapRef}/>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setTileFailed(true), load: () => setTileFailed(false) }}/>
        <MapNavigation active={Boolean(activeSector || hoveredSector)} onReset={handleCloseModal}/>
        {pins.map(({ sector, icon, price }) => <Marker key={sector.sector} position={[sector.latitude, sector.longitude]} icon={icon} title={`${sector.sector}: median ₹${price} Cr`}
          zIndexOffset={activeSector === sector.sector || hoveredSector === sector.sector ? 1000 : 0}
          eventHandlers={{ click: () => setActiveSector(sector.sector), mouseover: () => setHoveredSector(sector.sector), mouseout: () => setHoveredSector(null) }}>
          <Tooltip direction="top"><strong>{sector.sector}</strong> · Median ₹{price} Cr{sector.resolution === 'city_fallback' ? ' · City-level fallback' : ''}</Tooltip>

        </Marker>)}
      </MapContainer>
      {tileFailed && <span className="tile-warning" role="status">Basemap unavailable. Sector overlays and the directory remain available.</span>}
    </div>
    {activeSector && activeRow && <GeoMapModal sector={activeSector} row={activeRow} onClose={handleCloseModal} onOpenSectorInsights={onOpenSectorInsights}/>}
    <div className="map-legend"><span><i style={{ background: '#0F172A' }}/> Under ₹2 Cr</span><span><i style={{ background: '#64748B' }}/> ₹2–5 Cr</span><span><i style={{ background: '#C2410C' }}/> ₹5 Cr+</span><small>Exact dataset median in ₹ Cr</small></div>
    <p className="analytics-footnote">{data.sectors.length} location labels displayed · {data.unmapped_sectors.length} not displayed. Reference points are approximate; shared icons fan out visually without moving their coordinates.</p>
    {!!data.unresolved_location_labels?.length && <p className="location-fallback-warning" role="status">Ambiguous {data.unresolved_location_labels.join(', ')}: shown at a dashed city-level marker. Its actual location remains unresolved.</p>}
    {data.coordinate_source?.provenance_url && <p className="analytics-footnote"><a href={data.coordinate_source.provenance_url} target="_blank" rel="noreferrer">Sector geometry source & attribution ↗</a></p>}
    {data.unmapped_sectors.length > 0 && <details className="data-details"><summary>Unmapped locations</summary><p>{data.unmapped_sectors.join(', ')}</p></details>}
  </div>;
}

export default memo(GeoMap);
