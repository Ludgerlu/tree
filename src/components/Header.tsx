/**
 * components/Header.tsx
 * Barre d'en-tête — reprend exactement les icônes SVG et les actions de
 * l'ancien index.html/script.js (fitView, zoom, ajouter, connexion, export, paramètres).
 */
import React from 'react';

interface Props {
  treeName: string;
  isAuthenticated: boolean;
  onAdd: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onExport: () => void;
  onSettings: () => void;
}

export default function Header({
  treeName,
  isAuthenticated,
  onAdd,
  onLogin,
  onLogout,
  onExport,
  onSettings,
}: Props) {
  return (
    <header id="site-header">
      <div className="header-left">
        <div className="logo-mark">🌳</div>
        <div>
          <h1 className="site-title">Arbre Généalogique</h1>
          <p className="site-subtitle">{treeName}</p>
        </div>
      </div>
      <nav className="header-nav">
        {isAuthenticated && (
          <button className="nav-btn accent" onClick={onAdd}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ajouter
          </button>
        )}
        {!isAuthenticated ? (
          <button className="nav-btn" onClick={onLogin} title="Connexion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3H5a2 2 0 00-2 2v14a2 2 0 002 2h10" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="21" y2="12" />
            </svg>
            Connexion
          </button>
        ) : (
          <button className="nav-btn" onClick={onLogout} title="Déconnexion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
          </button>
        )}
        <button className="nav-btn" onClick={onExport}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exporter
        </button>
        <button className="nav-btn" onClick={onSettings} title="Paramètres">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3" />
          </svg>
        </button>
      </nav>
    </header>
  );
}
