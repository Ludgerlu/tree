/**
 * components/ZoomControls.tsx
 * Contrôles de zoom flottants (bas-droite du canvas) : +, niveau %, −, recadrer.
 */
import React from 'react';

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}

const icon = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, onFit }: Props) {

  return (
    <div id="zoom-controls" aria-label="Contrôles de zoom">
      <button type="button" className="zoom-btn" onClick={onZoomIn} title="Zoom avant" aria-label="Zoom avant">
        <svg {...icon}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
      <button type="button" className="zoom-level-btn" onClick={onReset} title="Réinitialiser le zoom" aria-label="Réinitialiser le zoom">
        <span id="zoom-level">{Math.round(scale * 100)}%</span>
      </button>
      <button type="button" className="zoom-btn" onClick={onZoomOut} title="Zoom arrière" aria-label="Zoom arrière">
        <svg {...icon}><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>
      <span className="zoom-divider"></span>
      <button type="button" className="zoom-btn" onClick={onFit} title="Tout afficher" aria-label="Tout afficher">
        <svg {...icon}><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" /></svg>
      </button>
    </div>
  );
}
