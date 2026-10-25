import DetailModal from '../DetailModal';
import DeferredPanel from './DeferredPanel';

export default function AnalyticsDetailDialog({ cardId, title, trigger, onClose, children }) {
  return <DetailModal id="analytics-card-detail" cardId={cardId} title={title} trigger={trigger} onClose={onClose}>
    <DeferredPanel kind="detail" label={`Loading ${title} details`}>{children}</DeferredPanel>
  </DetailModal>;
}
