import React from 'react';

interface Props {
  onHome: () => void;
  onAdd: () => void;
  onExport: () => void;
  onSettings: () => void;
}

const iconProps = {
  width: 23,
  height: 23,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export default function BottomNav({ onHome, onAdd, onExport, onSettings }: Props) {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      <button type="button" className="bottom-nav-item active" onClick={onHome} aria-current="page">
        <svg {...iconProps}><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></svg>
        <span>Arbre</span>
      </button>
      <button type="button" className="bottom-nav-item" onClick={onAdd}>
        <svg {...iconProps}><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1a7 7 0 0 1 14 0v1M19 8v6m-3-3h6" /></svg>
        <span>Ajouter</span>
      </button>
      <button type="button" className="bottom-nav-item" onClick={onExport}>
        <svg {...iconProps}><path d="M12 15V3m-4 4 4-4 4 4" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        <span>Exporter</span>
      </button>
      <button type="button" className="bottom-nav-item" onClick={onSettings}>
        <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.1.9-1.2 2.1-1.4-.5a7.8 7.8 0 0 1-1.6.9l-.3 1.5h-2.4l-.3-1.5a7.8 7.8 0 0 1-1.6-.9l-1.4.5-1.2-2.1 1.1-.9a6.8 6.8 0 0 1 0-1.9l-1.1-.9 1.2-2.1 1.4.5a7.8 7.8 0 0 1 1.6-.9l.3-1.5h2.4l.3 1.5a7.8 7.8 0 0 1 1.6.9l1.4-.5 1.2 2.1-1.1.9a6.8 6.8 0 0 1-.1 1.8Z" transform="translate(-1 -1)" /></svg>
        <span>Réglages</span>
      </button>
    </nav>
  );
}