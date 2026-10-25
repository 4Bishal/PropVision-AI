import DetailModal from '../DetailModal';
import SectorOverviewMatches from './SectorOverviewMatches';
export default function GeoMapModal({ sector, row, onClose, onOpenSectorInsights }) {
  if (!sector || !row || row.sector !== sector) return null;
  return <DetailModal testId="geomap-sector-modal" title="Sector property details" sector={sector} onClose={onClose} className="sector-map-modal">
    <SectorOverviewMatches key={sector} sector={sector} row={row}/>
    <div className="sector-reference-details">
      <p className="marker-location-note">{row.location_note || 'Approximate sector reference, not an individual property location.'}</p>
      {row.source_url && <a href={row.source_url} target="_blank" rel="noreferrer">Sector reference source &nearr;</a>}
      {onOpenSectorInsights && <button type="button" className="map-primary-action" onClick={() => { onClose(); onOpenSectorInsights(sector); }}>View Sector Insights &rarr;</button>}
    </div>
  </DetailModal>;
}
