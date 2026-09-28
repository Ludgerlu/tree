/**
 * hooks/usePanZoom.ts
 * Reprend initPan()/applyTransform()/zoomIn()/zoomOut()/fitView() de l'ancien script.js.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function usePanZoom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const inner = containerRef.current;
    if (!inner) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startSL = 0;
    let startST = 0;

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

    return () => {
      inner.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      inner.removeEventListener('wheel', onWheel);
    };
  }, []);

  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s + 0.12)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.3, s - 0.12)), []);

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

  return { containerRef, svgRef, scale, zoomIn, zoomOut, fitView };
}
