// All dialogs share one lock; closing a child must not unlock its parent.
const locks = new Set();
export function lockBodyScroll() {
  const token = Symbol('dialog');
  locks.add(token);
  document.body.style.overflow = 'hidden';
  return () => {
    locks.delete(token);
    if (!locks.size) {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }
  };
}
