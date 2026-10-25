import { useLayoutEffect, useSyncExternalStore } from 'react';
export function readTheme() {
  try { return localStorage.getItem('propvision-theme') === 'dark' ? 'dark' : 'light'; }
  catch { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
}
const subscribe = (listener) => {
  window.addEventListener('propvision-theme-change', listener); window.addEventListener('storage', listener);
  return () => { window.removeEventListener('propvision-theme-change', listener); window.removeEventListener('storage', listener); };
};
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#090D16' : '#0F172A';
}
export default function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light');
  useLayoutEffect(() => applyTheme(theme), [theme]);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('propvision-theme', next); } catch { /* Storage is optional. */ }
    window.dispatchEvent(new Event('propvision-theme-change'));
  };
  return { theme, toggle };
}
