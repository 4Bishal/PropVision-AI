import { memo, startTransition, Suspense, useEffect, useRef, useState } from 'react';
import { VisualSkeleton } from './AnalyticsSkeleton';
import { scheduleVisualWork } from './scheduleVisualWork';

export default memo(function DeferredPanel({ children, kind = 'chart', label }) {
  const ref = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setNearViewport(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: '160px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!nearViewport || ready) return;
    return scheduleVisualWork(() => startTransition(() => setReady(true)), { idle: true });
  }, [nearViewport, ready]);
  const fallback = <VisualSkeleton kind={kind} label={label}/>;
  return <div ref={ref} className={`visual-slot ${kind === 'map' ? 'map-visual-slot' : kind === 'features' ? 'feature-visual-slot' : kind === 'detail' ? 'detail-visual-slot' : 'chart-visual-slot'}`}>
    {ready ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
  </div>;
});
