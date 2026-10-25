import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import useTheme from '../hooks/useTheme';
export { readTheme } from '../hooks/useTheme';
export default memo(function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  return <button type="button" data-testid="theme-toggle" className={`icon-button theme-button ${className}`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={toggle}>
    {theme === 'light' ? <Sun size={20} className="theme-sun"/> : <Moon size={20} className="theme-moon"/>}
  </button>;
});
