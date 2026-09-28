import React from 'react';

export default function LoadingOverlay({ visible }: { visible: boolean }) {
  return (
    <div id="loading-overlay" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="loading-spinner" />
      <p>Chargement…</p>
    </div>
  );
}
