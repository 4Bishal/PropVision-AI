import { useEffect, useState } from 'react';
import { request } from '../../api';
import RecommendationCarousel from './RecommendationCarousel';

// Key by serialized context so sector/form changes cancel and replace the feed.
export default function RecommendationFeed({ specs, propertyId, title, currentProperty }) {
  const endpoint = propertyId !== undefined && propertyId !== null ? 'similar' : 'contextual';
  const body = JSON.stringify(endpoint === 'similar' ? { property_id: propertyId, top_n: 6 } : { ...specs, top_n: 6 });
  return <Feed key={`${endpoint}:${body}`} endpoint={endpoint} body={body} title={title} currentProperty={currentProperty}/>;
}
function Feed({ endpoint, body, title, currentProperty }) {
  const [state, setState] = useState({ loading: true, properties: [] });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request(`/api/recommend/${endpoint}`, { body: JSON.parse(body), signal: controller.signal }).then((properties) => {
      if (!Array.isArray(properties)) throw new Error('Recommendation response is incomplete.');
      if (!controller.signal.aborted) setState({ loading: false, properties });
    }).catch((error) => { if (!controller.signal.aborted) setState({ loading: false, properties: [], error }); });
    return () => controller.abort();
  }, [endpoint, body, revision]);
  const retry = () => { setState({ loading: true, properties: [] }); setRevision((v) => v + 1); };
  return <RecommendationCarousel {...state} title={title} currentProperty={currentProperty} onRetry={retry}/>;
}
