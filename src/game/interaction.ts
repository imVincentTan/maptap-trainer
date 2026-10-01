/**
 * Pointer interaction layer for the globe.
 *
 * v1 ships `click` mode: a quick press-and-release without dragging fires a
 * guess. The mode switch is deliberately centralized here so a future
 * `long-press` mode (hold to guess instead of click) only touches this file:
 * start a hold timer in `onPointerDown`, fire `onGuess` when it elapses, and
 * cancel it once the pointer moves past the drag tolerance.
 */
export type GuessTriggerMode = 'click' | 'long-press';

export interface GlobeInteractionHandlers {
  /** Drag deltas in CSS pixels while the pointer is down. */
  onRotate: (deltaX: number, deltaY: number) => void;
  /** Wheel/trackpad zoom delta; positive means zoom out. */
  onZoom: (deltaY: number) => void;
  /** Guess attempt at a point in element-relative CSS pixels. */
  onGuess: (x: number, y: number) => void;
}

export interface GlobeInteractionOptions {
  /** How a guess is triggered. Only 'click' is implemented in v1. */
  mode?: GuessTriggerMode;
  /** Max pointer travel for a press to still count as a guess, in px. */
  moveTolerancePx?: number;
  /** Max press duration for a click guess, in ms. */
  maxClickMs?: number;
  /** Hold duration for the future 'long-press' mode, in ms. */
  longPressMs?: number;
}

export function attachGlobeInteraction(
  el: HTMLElement,
  handlers: GlobeInteractionHandlers,
  options: GlobeInteractionOptions = {},
): () => void {
  const mode = options.mode ?? 'click';
  const moveTolerance = options.moveTolerancePx ?? 6;
  const maxClickMs = options.maxClickMs ?? 600;

  if (mode !== 'click') {
    // Reserved for the long-press toggle; fall back to click until implemented.
    console.warn(`maptap: guess trigger mode "${mode}" is not implemented yet, using "click"`);
  }

  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startTime = 0;
  let dragged = false;

  const onPointerDown = (e: PointerEvent) => {
    if (activePointerId !== null) return; // one pointer rotates at a time
    activePointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    startTime = performance.now();
    dragged = false;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture can fail for synthetic events; dragging still works.
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!dragged && Math.hypot(e.clientX - startX, e.clientY - startY) > moveTolerance) {
      dragged = true;
    }
    if (dragged && (dx !== 0 || dy !== 0)) handlers.onRotate(dx, dy);
  };

  const finishPress = (e: PointerEvent, allowGuess: boolean) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const duration = performance.now() - startTime;
    if (allowGuess && !dragged && duration <= maxClickMs) {
      const rect = el.getBoundingClientRect();
      handlers.onGuess(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const onPointerUp = (e: PointerEvent) => finishPress(e, true);
  const onPointerCancel = (e: PointerEvent) => finishPress(e, false);

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    handlers.onZoom(e.deltaY);
  };

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerCancel);
  el.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerCancel);
    el.removeEventListener('wheel', onWheel);
  };
}
