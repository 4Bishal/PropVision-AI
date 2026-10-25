import { lockBodyScroll } from './bodyScrollLock';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Native top-layer dialog supplies focus containment and makes the page inert.
export default function DetailModal({ id, title, sector, trigger, onClose, children, className = '', cardId, testId, closeTestId = 'btn-close-modal' }) {
  const ref = useRef(null);
  const dismissed = useRef(false);
  const titleId = useId();
  const dismiss = () => {
    dismissed.current = true;
    document.activeElement?.blur?.();
    onClose();
  };
  useEffect(() => {
    const dialog = ref.current;
    const unlock = lockBodyScroll();
    dismissed.current = false;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      unlock();
      // Native close may restore focus itself; clear it after explicit dismissal
      // so Escape/mouse close cannot leave a trigger's focus outline behind.
      if (dismissed.current) document.activeElement?.blur?.();
      else if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [trigger]);
  return createPortal(<dialog data-testid={testId} ref={ref} id={id} className={`detail-modal analytics-detail-dialog max-w-4xl w-full ${className}`}
    aria-labelledby={titleId} data-card-id={cardId} onCancel={(event) => { event.preventDefault(); event.stopPropagation(); dismiss(); }}
    onClick={(event) => {
      if (event.target !== ref.current) return;
      const box = ref.current.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss();
    }}>
    <header className="detail-modal-header"><div><span className="detail-indicator">{sector ? `Active Sector: ${sector}` : 'MARKET DETAIL'}</span><h2 data-testid="sector-modal-title" id={titleId}>{title}</h2></div>
      <button data-testid={closeTestId} type="button" autoFocus aria-label="Close detail view" className="modal-close outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/40" onClick={dismiss}><span>ESC</span><X size={22}/></button></header>
    <div className="detail-modal-content">{children}</div>
  </dialog>, document.body);
}
