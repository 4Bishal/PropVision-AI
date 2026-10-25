import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import ThemeToggle from '../ThemeToggle';
export default function FloatingThemeToggle() {
  const [host, setHost] = useState(document.body);
  useEffect(() => {
    const update = () => {
      const dialogs = document.querySelectorAll('dialog[open]');
      setHost(dialogs.length ? dialogs[dialogs.length - 1] : document.body);
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    update();
    return () => observer.disconnect();
  }, []);
  // A normal z-index cannot cover native top-layer dialogs. Keep the control in
  // the active dialog so it remains visible and keyboard-accessible in overlays.
  return createPortal(<ThemeToggle className="floating-theme-switcher"/>, host);
}
