/**
 * hooks/usePanZoom.ts
 * Reprend initPan()/applyTransform()/zoomIn()/zoomOut()/fitView() de l'ancien script.js.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePanZoom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  useEffect(() => {
    const inner = containerRef.current;
    if (!inner) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startSL = 0;
    let startST = 0;
    let touchStartDistance = 0;
    let touchStartScale = 1;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartScrollLeft = 0;
    let touchStartScrollTop = 0;

    const distanceBetweenTouches = (touches: TouchList) => {
      const deltaX = touches[0].clientX - touches[1].clientX;
      const deltaY = touches[0].clientY - touches[1].clientY;
      return Math.hypot(deltaX, deltaY);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        touchStartDistance = distanceBetweenTouches(e.touches);
        touchStartScale = scaleRef.current;
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartScrollLeft = inner.scrollLeft;
        touchStartScrollTop = inner.scrollTop;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        const distance = distanceBetweenTouches(e.touches);
        if (touchStartDistance > 0) {
          setScale(Math.max(0.3, Math.min(3, touchStartScale * distance / touchStartDistance)));
        }
      } else if (e.touches.length === 1) {
        e.preventDefault();
        inner.scrollLeft = touchStartScrollLeft - (e.touches[0].clientX - touchStartX);
        inner.scrollTop = touchStartScrollTop - (e.touches[0].clientY - touchStartY);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.node-group')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startSL = inner.scrollLeft;
      startST = inner.scrollTop;
      inner.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      inner.scrollLeft = startSL - (e.clientX - startX);
      inner.scrollTop = startST - (e.clientY - startY);
    };
    const onMouseUp = () => {
      dragging = false;
      inner.style.cursor = 'grab';
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setScale((s) => Math.max(0.3, Math.min(3, s + delta)));
    };

    inner.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    inner.addEventListener('wheel', onWheel, { passive: false });
    inner.addEventListener('touchstart', onTouchStart, { passive: true });
    inner.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      inner.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      inner.removeEventListener('wheel', onWheel);
      inner.removeEventListener('touchstart', onTouchStart);
      inner.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.12)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.3, s - 0.12)), []);

  const resetZoom = useCallback(() => setScale(1), []);

  const focusMember = useCallback((memberId: string) => {
    const inner = containerRef.current;
    const svg = svgRef.current;
    const node = svg && Array.from(svg.querySelectorAll<SVGGElement>('.node-group'))
      .find((candidate) => candidate.dataset.id === memberId);
    if (!inner || !node) return false;

    const nodeBounds = node.getBoundingClientRect();
    const containerBounds = inner.getBoundingClientRect();
    inner.scrollLeft += nodeBounds.left + nodeBounds.width / 2 - (containerBounds.left + containerBounds.width / 2);
    inner.scrollTop += nodeBounds.top + nodeBounds.height / 2 - (containerBounds.top + containerBounds.height / 2);
    return true;
  }, []);

  const fitView = useCallback(() => {
    const inner = containerRef.current;
    const wrap = inner?.parentElement; // #canvas-wrap
    const svg = svgRef.current;
    if (!inner || !wrap || !svg) return;
    const sw = parseFloat(svg.getAttribute('width') || '0');
    const sh = parseFloat(svg.getAttribute('height') || '0');
    if (!sw || !sh) return;
    const sx = (wrap.clientWidth - 80) / sw;
    const sy = (wrap.clientHeight - 80) / sh;
    setScale(Math.min(sx, sy, 1));
    inner.scrollLeft = 0;
    inner.scrollTop = 0;
  }, []);

  return { containerRef, svgRef, scale, zoomIn, zoomOut, resetZoom, fitView, focusMember };
}
