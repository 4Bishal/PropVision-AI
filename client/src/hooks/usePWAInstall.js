import { useEffect, useRef, useState } from 'react';
export default function usePWAInstall() {
  const pending = useRef(null);
  const [available, setAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);
  useEffect(() => {
    const ready = (event) => { event.preventDefault(); pending.current = event; setAvailable(true); };
    const installed = () => { pending.current = null; setAvailable(false); setInstalling(false); };
    window.addEventListener('beforeinstallprompt', ready); window.addEventListener('appinstalled', installed);
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', installed); };
  }, []);
  const install = async () => {
    const prompt = pending.current;
    if (!prompt || installing) return;
    pending.current = null; setAvailable(false); setInstalling(true);
    try { await prompt.prompt(); } catch { /* Browser may dismiss or invalidate a one-use prompt. */ }
    finally { setInstalling(false); }
  };
  return { available, installing, install };
}
