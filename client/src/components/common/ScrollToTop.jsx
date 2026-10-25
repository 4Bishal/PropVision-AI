import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 300);
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  if (!visible) return null;
  return <button data-testid="btn-scroll-top" type="button" className="scroll-to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0,
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })}><ChevronUp size={23}/></button>;
}
