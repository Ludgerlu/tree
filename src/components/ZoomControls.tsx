/**
 * components/ZoomControls.tsx
 * Contrôles de zoom flottants (bas-droite du canvas) : +, niveau %, −, recadrer.
 */
import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Member } from '../types';

interface Props {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
  members: Member[];
  onFocusMember: (id: string) => boolean;
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

export default function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, onFit, members, onFocusMember }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const searchMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery || searching) return;

    setSearching(true);
    setSearchMessage('Recherche en cours…');
    window.setTimeout(() => {
      const matchingMember = members.find((member) =>
        `${member.firstname} ${member.lastname}`.trim().toLocaleLowerCase() === normalizedQuery
      ) ?? members.find((member) =>
        `${member.firstname} ${member.lastname}`.trim().toLocaleLowerCase().includes(normalizedQuery)
      );

      if (matchingMember && onFocusMember(matchingMember.id)) {
        setSearchMessage(`${matchingMember.firstname} ${matchingMember.lastname} trouvé`);
      } else {
        setSearchMessage('Aucune personne trouvée');
      }
      setSearching(false);
    }, 300);
  };

  return (
    <div id="zoom-controls" aria-label="Contrôles de zoom">
      <button
        type="button"
        className="zoom-btn"
        onClick={() => setSearchOpen((open) => !open)}
        title="Rechercher une personne"
        aria-label="Rechercher une personne"
        aria-expanded={searchOpen}
        aria-controls="tree-person-search"
      >
        <svg {...icon}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
      </button>
      {searchOpen && (
        <form id="tree-person-search" className="zoom-search" onSubmit={searchMember}>
          <label htmlFor="tree-person-search-input">Rechercher une personne</label>
          <div className="zoom-search-row">
            <input
              ref={searchInputRef}
              id="tree-person-search-input"
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSearchMessage('');
              }}
              placeholder="Nom ou prénom"
              autoComplete="off"
            />
            <button type="submit" disabled={!query.trim() || searching} aria-label="Lancer la recherche">
              {searching ? <span className="search-spinner" aria-hidden="true" /> : 'OK'}
            </button>
          </div>
          <p className="zoom-search-status" role="status" aria-live="polite">
            {searching ? <><span className="search-spinner" aria-hidden="true" />{searchMessage}</> : searchMessage}
          </p>
        </form>
      )}
      <span className="zoom-divider"></span>
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
