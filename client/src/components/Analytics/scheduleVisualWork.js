/** Allow a placeholder to paint before optional main-thread visual work. */
export function scheduleVisualWork(callback, { idle = false } = {}) {
  let cancelled = false;
  let firstFrame, secondFrame, timer, idleTask;
  const run = () => { if (!cancelled) callback(); };
  const queue = () => {
    if (idle && typeof window.requestIdleCallback === 'function') {
      idleTask = window.requestIdleCallback(run, { timeout: 300 });
    } else timer = window.setTimeout(run, 0);
  };
  if (typeof window.requestAnimationFrame === 'function') {
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(queue);
    });
  } else timer = window.setTimeout(queue, 0);
  return () => {
    cancelled = true;
    window.cancelAnimationFrame?.(firstFrame);
    window.cancelAnimationFrame?.(secondFrame);
    window.clearTimeout(timer);
    if (idleTask !== undefined) window.cancelIdleCallback?.(idleTask);
  };
}
