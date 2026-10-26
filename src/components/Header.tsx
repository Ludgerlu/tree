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
  onProfile: () => void;
}

export default function Header({
  treeName,
  isAuthenticated,
  onAdd,
  onLogin,
  onLogout,
  onExport,
  onSettings,
  onProfile,
}: Props) {
  return (
    <header id="site-header">
      <div className="header-left">
        <button type="button" className="nav-btn sidebar-menu-button" onClick={onProfile} title="Ouvrir le menu" aria-label="Ouvrir le menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <div className="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M16 27V16m0 6-6-5m6 2 6-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 4c-2.8 0-4.5 2.2-4.1 4.6-2.6-.6-4.8 1.3-4.8 3.8 0 2.4 1.9 4.1 4.2 4.1h9.4c2.4 0 4.2-1.8 4.2-4.1 0-2.5-2.2-4.4-4.8-3.8C20.5 6.2 18.8 4 16 4Z" fill="currentColor" opacity=".2" />
            <path d="M16 4c-2.8 0-4.5 2.2-4.1 4.6-2.6-.6-4.8 1.3-4.8 3.8 0 2.4 1.9 4.1 4.2 4.1h9.4c2.4 0 4.2-1.8 4.2-4.1 0-2.5-2.2-4.4-4.8-3.8C20.5 6.2 18.8 4 16 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="header-tree-identity">
          <h1 className="site-title" title={treeName}>{treeName}</h1>
          <span className="site-subtitle">Arbre familial</span>
        </div>
      </div>
      <nav className="header-nav" aria-label="Actions de l'arbre">
        {isAuthenticated && (
          <button type="button" className="nav-btn accent header-action" onClick={onAdd} title="Ajouter un membre">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Ajouter</span>
          </button>
        )}
        {isAuthenticated && (
          <button type="button" className="nav-btn header-icon-action" onClick={onExport} title="Exporter l'arbre" aria-label="Exporter l'arbre">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15V3m-5 5 5-5 5 5" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
            </svg>
            <span>Exporter</span>
          </button>
        )}
        {isAuthenticated && (
          <button type="button" className="nav-btn header-icon-action" onClick={onSettings} title="Paramètres" aria-label="Paramètres">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M21 12h-2M5 12H3M12 21v-2M12 5V3" />
            </svg>
            <span>Paramètres</span>
          </button>
        )}
        {!isAuthenticated ? (
          <button type="button" className="nav-btn header-action" onClick={onLogin} title="Connexion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3H5a2 2 0 00-2 2v14a2 2 0 002 2h10" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="21" y2="12" />
            </svg>
            <span>Connexion</span>
          </button>
        ) : (
          <button type="button" className="nav-btn header-icon-action" onClick={onLogout} title="Déconnexion" aria-label="Déconnexion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Quitter</span>
          </button>
        )}
      </nav>
    </header>
  );
}