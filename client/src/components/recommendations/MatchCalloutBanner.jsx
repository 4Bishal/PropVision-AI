import { Radar, ArrowUpRight } from 'lucide-react';
export default function MatchCalloutBanner({ properties = [], loading, error, onOpen }) {
  const best = Math.max(0, ...properties.map((p) => p.match_percentage));
  return <div className="match-radar" role="status">
    <span className="radar-icon"><Radar size={30}/></span><div className="min-w-0 flex-1"><span className="recommendation-eyebrow">AI RECOMMENDATION RADAR</span>
      <h3>{loading ? 'Scanning for your property matches…' : error ? 'Your radar needs a retry' : `${properties.length} Similar Properties Found`}</h3>
      <p>{loading ? 'Matching your location, space and estimated budget.' : 'Ranked alternatives from the Gurgaon dataset snapshot.'}</p>
      {!!properties.length && <span className="radar-confidence">{best}% Vector Match</span>}
    </div>{onOpen && <button type="button" onClick={onOpen} className="radar-open">Explore matches<ArrowUpRight size={18}/></button>}
  </div>;
}
