import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import usePWAInstall from './hooks/usePWAInstall';
import ScrollToTop from './components/common/ScrollToTop';
import { lazy, memo, startTransition, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChartColumnBig, CircleAlert, Compass, House, Lightbulb, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { request, validateOptions } from './api';
import Predictor from './components/Predictor';
import FloatingThemeToggle from './components/common/FloatingThemeToggle';
import AnalyticsSkeleton from './components/Analytics/AnalyticsSkeleton';
import InsightsSkeleton from './components/Insights/InsightsSkeleton';
import { scheduleVisualWork } from './components/Analytics/scheduleVisualWork';
const AnalyticsDashboard = memo(lazy(() => import('./components/Analytics/AnalyticsDashboard')));
const InsightsDashboard = memo(lazy(() => import('./components/Insights/InsightsDashboard')));
const MemoPredictor = memo(Predictor);

export default function App() {
  const fromPath = () => ({ '/predictor': 'predict', '/analytics': 'analytics', '/insights': 'insights', '/recommendations': 'predict' }[window.location.pathname] || 'analytics');
  const [tab, setTab] = useState(fromPath);
  const { available: canInstall, installing, install } = usePWAInstall();
  const [schema, setSchema] = useState(null);
  const [connection, setConnection] = useState({ express: 'checking', ml: 'checking' });
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState('');
  const [readyTab, setReadyTab] = useState(null);
  const [analyticsMounted, setAnalyticsMounted] = useState(false);
  const [insightsMounted, setInsightsMounted] = useState(false);
  const [sectorRequest, setSectorRequest] = useState(null);
  const navigate = useCallback((next) => {
    const path = { predict: '/predictor', analytics: '/analytics', insights: '/insights' }[next];
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setTab(next);
    if (next === 'predict') setReadyTab(next);
  }, []);
  useEffect(() => {
    const redirectRetiredRoute = () => { if (window.location.pathname === '/recommendations') window.history.replaceState({}, '', '/predictor'); };
    redirectRetiredRoute();
    const restore = () => { redirectRetiredRoute(); const next = fromPath(); setTab(next); if (next === 'predict') setReadyTab(next); };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const openSectorInsights = useCallback((sector) => {
    // A sequence token lets a repeated visit to the same sector reopen its report.
    setSectorRequest((previous) => ({ sector, id: (previous?.id || 0) + 1,
      trigger: document.getElementById('tab-insights') }));
    navigate('insights');
  }, [navigate]);
  useEffect(() => {
    if (tab === 'predict') return;
    return scheduleVisualWork(() => startTransition(() => {
      if (tab === 'analytics') setAnalyticsMounted(true);
      else setInsightsMounted(true);
      setReadyTab(tab);
    }));
  }, [tab]);
  const navigationPending = tab !== 'predict' && readyTab !== tab;
  const pending = useRef(null);
  const healthPending = useRef(null);
  const toastTimer = useRef(null);
  const notify = useCallback((message) => {
    setToast(message); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 9000);
  }, []);
  const onConnection = useCallback((error) => {
    if (!error) setConnection({ express: 'online', ml: 'online' });
    else if (error.code === 'NETWORK_ERROR') setConnection({ express: 'offline', ml: 'unknown' });
    else if (error.code?.startsWith('ML_')) setConnection({ express: 'online', ml: ['ML_REQUEST_REJECTED'].includes(error.code) ? 'online' : 'offline' });
    // Database errors do not imply the ML service is down.
  }, []);

  const connect = useCallback(async (showError = true) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller; setChecking(true);
    try {
      const data = validateOptions(await request('/api/schema-options', { signal: controller.signal }));
      setSchema((previous) => JSON.stringify(previous) === JSON.stringify(data) ? previous : data);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setSchema(null);
      setConnection({ express: error.status ? 'online' : 'offline', ml: error.status ? 'offline' : 'unknown' });
      if (showError) notify(error.message);
    } finally { if (!controller.signal.aborted) setChecking(false); }
  }, [notify]);

  useEffect(() => {
    connect(); const interval = setInterval(() => connect(false), 60000);
    return () => { clearInterval(interval); pending.current?.abort(); clearTimeout(toastTimer.current); };
  }, [connect]);
  const refreshHealth = useCallback(async () => {
    healthPending.current?.abort();
    const controller = new AbortController(); healthPending.current = controller;
      try {
        const status = await request('/api/health', { signal: controller.signal, timeoutMs: 15000 });
        if (status.express && status.fastapi) setConnection({ express: status.express, ml: status.fastapi });
      } catch (error) {
        if (error.name !== 'AbortError') setConnection({ express: error.status ? 'online' : 'offline', ml: error.status ? 'offline' : 'unknown' });
      }
  }, []);

  useEffect(() => {
    refreshHealth(); const timer = setInterval(refreshHealth, 30000);
    return () => { healthPending.current?.abort(); clearInterval(timer); };
  }, [refreshHealth]);

  return <div className="app-shell">
    <ScrollToTop/>
    <FloatingThemeToggle/>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <Navbar onPredictor={() => navigate('predict')}>
      <nav className="main-navigation" role="tablist" aria-label="Main workspace">
        {[['predict', 'Price Predictor', House], ['analytics', 'GeoMap Analytics', ChartColumnBig], ['insights', 'Market Insights', Lightbulb]].map(([value, label, Icon], index) => <button key={value} data-testid={`nav-${value}`} id={`tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`view-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => navigate(value)} onKeyDown={(event) => {
          const tabs = ['predict', 'analytics', 'insights'];
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
          navigate(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus();
        }}><Icon size={16}/><span>{label}</span></button>)}
      </nav>
      <div className="header-right"><div className="connection-group" aria-label="Service connections">{[['express', 'Express'], ['ml', 'ML engine']].map(([key, label]) => <span className="status" key={key} title={key === 'ml' ? 'FastAPI health checked every 30 seconds' : 'Express API connection'}><span className={`status-dot ${connection[key]}`}/>{label}<span className="sr-only"> {connection[key]}</span></span>)}<button type="button" className="icon-button" aria-label="Refresh API connection" onClick={() => { connect(); refreshHealth(); }} disabled={checking}><RefreshCw size={14} className={checking ? 'animate-spin' : ''}/></button></div></div>
    </Navbar>
    <main id="workspace" className="main-content">
      <section className="intro analytics-intro"><div><div className="intro-kicker"><span/> {tab === 'predict' ? 'A SMARTER WAY TO SEE REAL ESTATE' : 'GURGAON REAL ESTATE INTELLIGENCE'}</div><h1>{tab === 'predict' ? 'Your next move.' : tab === 'insights' ? 'Beyond the numbers.' : 'Every sector.'} <br className="mobile-break"/><em>{tab === 'predict' ? 'A clearer perspective.' : tab === 'insights' ? 'A sharper perspective.' : 'A different story.'}</em></h1><p>{tab === 'predict' ? 'Understand what a home is worth. Make your next move with confidence.' : 'Explore the price, place and property patterns shaping your next decision.'}</p></div><div className="market-label"><MapMarker/><span>GURGAON, INDIA<small>Local insight. Intelligent decisions.</small></span></div></section>
      {!schema && <div className="connection-banner" role="status">{checking ? <LoaderCircle size={17} className="animate-spin"/> : <CircleAlert size={18}/>}<span>{checking ? 'Connecting to your property intelligence engine…' : 'Property tools are temporarily unavailable. Check your API services and retry.'}</span>{!checking && <button onClick={() => connect()}>Retry connection <ArrowRight size={14}/></button>}</div>}
      <div className="workspace-stage">
        {navigationPending && (tab === 'insights' ? <InsightsSkeleton/> : <AnalyticsSkeleton/>)}
        <section className="workspace-pane" data-active={tab === 'predict'} role="tabpanel" id="view-predict" aria-labelledby="tab-predict" aria-hidden={tab !== 'predict'} inert={tab !== 'predict'}><MemoPredictor schema={schema} notify={notify} onConnection={onConnection}/></section>
        <section className="workspace-pane" data-active={tab === 'analytics' && !navigationPending} role="tabpanel" id="view-analytics" aria-labelledby="tab-analytics" aria-hidden={tab !== 'analytics' || navigationPending} inert={tab !== 'analytics' || navigationPending}>
          {analyticsMounted && <Suspense fallback={<AnalyticsSkeleton/>}><AnalyticsDashboard schema={schema} notify={notify} onConnection={onConnection} onOpenSectorInsights={openSectorInsights}/></Suspense>}
        </section>
        <section className="workspace-pane" data-active={tab === 'insights' && !navigationPending} role="tabpanel" id="view-insights" aria-labelledby="tab-insights" aria-hidden={tab !== 'insights' || navigationPending} inert={tab !== 'insights' || navigationPending}>
          {insightsMounted && <Suspense fallback={<InsightsSkeleton/>}><InsightsDashboard notify={notify} onConnection={onConnection} sectorRequest={sectorRequest}/></Suspense>}
        </section>
      </div>
      <Footer>{canInstall && <button type="button" className="ghost-action" data-testid="btn-install-app" disabled={installing} onClick={install}>Install PropVision AI App</button>}</Footer>
    </main>
    {toast && <div className="toast" role="alert"><CircleAlert size={21}/><div><strong>Something needs your attention</strong><p>{toast}</p></div><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={18}/></button></div>}
  </div>;
}

function MapMarker() { return <span className="market-icon"><Compass size={23} strokeWidth={1.5}/></span>; }
