import { memo } from 'react';

export default memo(function InsightsSkeleton() {
  return <div className="insights-workspace insights-skeleton" role="status" aria-label="Loading market insights" aria-busy="true">
    <span className="sr-only">Preparing your market brief</span><div className="brief-skeleton"><i/><b/><i/><i/></div>
    <div className="insights-sector-grid">{[0, 1, 2].map((id) => <div className="insights-card" key={id} aria-hidden="true"><i/><b/><i/><i/><i/></div>)}</div>
  </div>;
});
