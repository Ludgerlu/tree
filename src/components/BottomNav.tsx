import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Member } from '../types';

interface Props {
  onHome: () => void;
  onAdd: () => void;
  onExport: () => void;
  onSettings: () => void;
  memberCount: number;
  members: Member[];
  onFocusMember: (id: string) => boolean;
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

export default function BottomNav({ memberCount, onHome, onAdd, onExport, onSettings, members, onFocusMember }: Props) {

  const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');
    const [searchResults, setSearchResults] = useState<Member[]>([]);
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
      setSearchResults([]);
      window.setTimeout(() => {
        const exactMatches = members.filter((member) =>
          `${member.firstname} ${member.lastname}`.trim().toLocaleLowerCase() === normalizedQuery
        );
        const matchingMembers = exactMatches.length ? exactMatches : members.filter((member) =>
          `${member.firstname} ${member.lastname}`.trim().toLocaleLowerCase().includes(normalizedQuery)
        );
  
        if (matchingMembers.length > 1) {
          setSearchResults(matchingMembers);
          setSearchMessage(`${matchingMembers.length} personnes trouvées. Choisissez la bonne personne.`);
        } else if (matchingMembers.length === 1 && onFocusMember(matchingMembers[0].id)) {
          setSearchMessage(`${matchingMembers[0].firstname} ${matchingMembers[0].lastname} trouvé`);
        } else {
          setSearchMessage('Aucune personne trouvée');
        }
        setSearching(false);
      }, 300);
    };
  
    const selectSearchResult = (member: Member) => {
      if (!onFocusMember(member.id)) {
        setSearchMessage('Impossible d’afficher cette personne');
        return;
      }
      setSearchResults([]);
      setSearchMessage(`${member.firstname} ${member.lastname} sélectionné`);
    };
  
    const getMemberClues = (member: Member) => {
      const clues = [
        member.birth ? `Né(e) ${member.birth.slice(0, 4)}` : '',
        member.death ? `Décès ${member.death.slice(0, 4)}` : '',
        member.birthplace || '',
        member.deathplace || '',
      ].filter(Boolean);
      const parent = members.find((candidate) => candidate.id === member.parentId);
      const spouse = members.find((candidate) => candidate.id === member.spouseId);
      if (parent) clues.push(`Parent : ${parent.firstname} ${parent.lastname}`);
      if (spouse) clues.push(`Conjoint(e) : ${spouse.firstname} ${spouse.lastname}`);
      return clues.join(' · ') || 'Aucun autre détail enregistré';
    };

  return (
    <nav className="bottom-nav row" aria-label="Navigation principale">
      <button type="button" className="bottom-nav-item active" onClick={onHome} aria-current="page">
        <div>
         {memberCount} 
        </div>
        <span>membre{memberCount > 1 ? 's' : ''}</span>
      </button>
      <button type="button" className="bottom-nav-item" onClick={onAdd}>
        <svg {...iconProps}><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-1a7 7 0 0 1 14 0v1M19 8v6m-3-3h6" /></svg>
        <span>Ajouter</span>
      </button>
      {/* <button type="button" className="bottom-nav-item" onClick={onExport}>
        <svg {...iconProps}><path d="M12 15V3m-4 4 4-4 4 4" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        <span>Exporter</span>
      </button> */}
      <button
        type="button"
        className="bottom-nav-item"
        onClick={() => setSearchOpen((open) => !open)}
        title="Rechercher une personne"
        aria-label="Rechercher une personne"
        aria-expanded={searchOpen}
        aria-controls="tree-person-search"
      >
        <svg {...iconProps}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
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
                setSearchResults([]);
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
          {searchResults.length > 0 && (
            <ul className="zoom-search-results" aria-label="Résultats de recherche">
              {searchResults.map((member, index) => (
                <li key={member.id}>
                  <button type="button" className="zoom-search-result" onClick={() => selectSearchResult(member)}>
                    <span className="zoom-search-result-name">{member.firstname} {member.lastname}</span>
                    <span className="zoom-search-result-detail">{getMemberClues(member)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}
    </nav>
  );
}