import useTheme from '../../hooks/useTheme';
export default function Navbar({ onPredictor, children }) {
  const { theme } = useTheme();
  return <header className="site-header intelligence-header"><div className="header-inner"><a href="/predictor" className="brand brand-asset" aria-label="PropVision AI home" onClick={(event) => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onPredictor(); } }}><img src={theme === 'dark' ? '/assets/logo-dark.png' : '/assets/logo.png'} alt="PropVision AI"/></a>{children}</div></header>;
}
