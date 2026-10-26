/**
 * components/DetailModal.tsx
 * Reprend openDetail()/buildDetailFamily() de l'ancien script.js.
 */
import React, { useEffect, useState } from 'react';
import { Member } from '../types';
import { ThemeDefinition } from '../types/theme';
import { formatDate, genColor, initials } from '../services/treeLayout';
import Modal from './Modal';

interface Rel {
  rel: string;
  person: Member;
}

interface Props {
  open: boolean;
  member: Member | null;
  members: Member[];
  genMemo: Record<string, number>;
  theme: ThemeDefinition;
  isAuthenticated: boolean;
  onClose: () => void;
  onJump: (id: string) => void;
  onEdit: (id: string) => void;
}

export default function DetailModal({ open, member, members, genMemo, theme, isAuthenticated, onClose, onJump, onEdit }: Props) {
  const [activeFamilySlide, setActiveFamilySlide] = useState(0);

  useEffect(() => {
    setActiveFamilySlide(0);
    if (!open || !member) return;

    const relativesCount = members.filter((candidate) =>
      candidate.id === member.parentId ||
      (candidate.id !== member.id && !!member.parentId && candidate.parentId === member.parentId) ||
      candidate.parentId === member.id
    ).length;
    if (relativesCount < 2) return;

    const interval = window.setInterval(() => {
      setActiveFamilySlide((current) => (current + 1) % relativesCount);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [open, member, members]);

  if (!member) {
    return (
      <Modal open={open} onClose={onClose} className="detail-box" overlayClassName="detail-overlay">
        <div />
      </Modal>
    );
  }

  const g = Math.min(genMemo[member.id] ?? 0, 4);
  const hasPhoto = !!(member.photo && member.photo.length > 5);

  const spouseItems: Rel[] = [];
  if (member.spouseId) {
    const sp = members.find((x) => x.id === member.spouseId);
    if (sp) spouseItems.push({ rel: 'Conjoint(e)', person: sp });
  }
  const parentItems: Rel[] = [];
  if (member.parentId) {
    const p = members.find((x) => x.id === member.parentId);
    if (p) parentItems.push({ rel: p.gender === 'F' ? 'Mère' : 'Père', person: p });
  }
  const siblingItems: Rel[] = members
    .filter((x) => x.id !== member.id && x.parentId && x.parentId === member.parentId)
    .map((x) => ({ rel: x.gender === 'F' ? 'Sœur' : 'Frère', person: x }));
  const childItems: Rel[] = members.filter((x) => x.parentId === member.id).map((x) => ({ rel: x.gender === 'F' ? 'Fille' : 'Fils', person: x }));
  const familyCarouselItems: Rel[] = [
    ...parentItems,
    ...siblingItems,
    ...childItems,
  ];
  const currentFamilySlide = familyCarouselItems.length ? activeFamilySlide % familyCarouselItems.length : 0;

  const changeFamilySlide = (nextIndex: number) => {
    setActiveFamilySlide((nextIndex + familyCarouselItems.length) % familyCarouselItems.length);
  };

  const dates: string[] = [];
  if (member.birth) dates.push('🎂 ' + formatDate(member.birth));
  if (member.death) dates.push('✝ ' + formatDate(member.death));

  const places: string[] = [];
  if (member.birthplace) places.push('📍 ' + member.birthplace);
  if (member.deathplace) places.push('📍 ' + member.deathplace);

  const renderSection = (title: string, items: Rel[]) => {
    if (!items.length) return null;
    return (
      <React.Fragment key={title}>
        <h3>{title}</h3>
        <ul className="family-list">
          {items.map(({ rel, person }) => {
            const pg = Math.min(genMemo[person.id] ?? 0, 4);
            const col = genColor(theme, pg);
            const colL = genColor(theme, pg, true);
            const pIni = initials(person).toUpperCase();
            const hasP = !!(person.photo && person.photo.length > 5);
            return (
              <li key={person.id} onClick={() => onJump(person.id)}>
                <div className="family-mini-avatar" style={{ borderColor: col, background: colL }}>
                  {hasP ? (
                    <img src={person.photo!} alt={person.firstname} />
                  ) : (
                    <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 12, fontWeight: 600, color: col }}>{pIni}</span>
                  )}
                </div>
                <span>
                  {person.firstname} {person.lastname}
                </span>
                <span className="family-tag">{rel}</span>
              </li>
            );
          })}
        </ul>
      </React.Fragment>
    );
  };

  return (
    <Modal open={open} onClose={onClose} className="detail-box profile-detail-box" overlayClassName="detail-overlay">
      <div className="modal-header">
        <div>
          {/* <p className="member-modal-eyebrow">PROFIL FAMILIAL</p> */}
          <p className="detail-header-caption">Fiche du membre</p>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer le profil">✕</button>
      </div>
      <div className="modal-body detail-modal-body">
        <section className="detail-profile-card" aria-label={`Profil de ${member.firstname} ${member.lastname}`}>
          <div className="detail-cover">
              <div className="detail-cover-placeholder" aria-hidden="true">{initials(member).toUpperCase()}</div>
          </div>
          <div className="detail-profile-content">
            <div className="detail-avatar" data-gen={g}>
              {hasPhoto ? <img src={member.photo!} alt={member.firstname} /> : initials(member).toUpperCase()}
            </div>
            <div className="detail-info">
              <h2 className="detail-member-name">{member.firstname} {member.lastname}</h2>
              <p className="detail-gen-badge">Génération {g + 1}</p>
            </div>
            <div className="detail-facts">
              {dates.length > 0 && <p className="detail-meta">{dates.join('  ·  ')}</p>}
              {places.length > 0 && <p className="detail-meta">{places.join('  ·  ')}</p>}
            </div>
          </div>
        </section>
        {member.notes && (
          <section className="detail-notes-section">
            <h3>À propos</h3>
            <p className="detail-notes">{member.notes}</p>
          </section>
        )}
        <div className="detail-family">
          {renderSection('Conjoint(e)', spouseItems)}
          {familyCarouselItems.length > 0 && <section className="detail-relative-carousel" aria-label="Parents, frères et sœurs et enfants">
            <div className="detail-relative-carousel-heading">
              <div><h3>Famille</h3><span>{familyCarouselItems.length} membre{familyCarouselItems.length === 1 ? '' : 's'}</span></div>
              {familyCarouselItems.length > 1 && <div className="member-family-carousel-controls">
                <button type="button" onClick={() => changeFamilySlide(currentFamilySlide - 1)} aria-label="Membres précédents">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button type="button" onClick={() => changeFamilySlide(currentFamilySlide + 1)} aria-label="Membres suivants">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>}
            </div>
            <div className="member-family-carousel-window">
              <div className="member-family-carousel-track" style={{ transform: `translateX(-${currentFamilySlide * 142}px)` }}>
                {familyCarouselItems.map(({ rel, person }) => {
                  const personInitials = initials(person).toLocaleUpperCase();
                  const personHasPhoto = !!(person.photo && person.photo.length > 5);
                  return <button type="button" className="member-profile-connection detail-family-slide" key={`${rel}-${person.id}`} onClick={() => onJump(person.id)}>
                    <span className="member-profile-connection-photo">
                      {personHasPhoto ? <img src={person.photo!} alt="" /> : personInitials}
                    </span>
                    <span className="member-profile-connection-copy"><strong>{person.firstname} {person.lastname}</strong><small>{rel}</small></span>
                  </button>;
                })}
              </div>
            </div>
            {familyCarouselItems.length > 1 && <div className="member-family-carousel-dots" aria-label={`Membre ${currentFamilySlide + 1} sur ${familyCarouselItems.length}`}>
              {familyCarouselItems.map(({ rel, person }, index) => <button type="button" key={`${rel}-${person.id}`} className={index === currentFamilySlide ? 'active' : ''} onClick={() => changeFamilySlide(index)} aria-label={`Afficher ${person.firstname} ${person.lastname}`} />)}
            </div>}
          </section>}
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>
          Fermer
        </button>
        {isAuthenticated && (
          <button className="btn-primary" onClick={() => onEdit(member.id)}>
            ✏ Modifier
          </button>
        )}
      </div>
    </Modal>
  );
}
