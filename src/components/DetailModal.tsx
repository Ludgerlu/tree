/**
 * components/DetailModal.tsx
 * Reprend openDetail()/buildDetailFamily() de l'ancien script.js.
 */
import React from 'react';
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
  if (!member) {
    return (
      <Modal open={open} onClose={onClose} className="detail-box">
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
    <Modal open={open} onClose={onClose} className="detail-box">
      <div className="modal-header">
        <h2 className="modal-title">
          {member.firstname} {member.lastname}
        </h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <div className="detail-hero">
          <div className="detail-avatar" data-gen={g}>
            {hasPhoto ? <img src={member.photo!} alt={member.firstname} /> : initials(member).toUpperCase()}
          </div>
          <div className="detail-info">
            <p className="detail-meta">{dates.join('  ·  ')}</p>
            <p className="detail-meta">{places.join('  ·  ')}</p>
            <p className="detail-gen-badge">Génération {g + 1}</p>
          </div>
        </div>
        {member.notes && <div className="detail-notes">{member.notes}</div>}
        <div className="detail-family">
          {renderSection('Conjoint(e)', spouseItems)}
          {renderSection('Parents', parentItems)}
          {renderSection('Frères & sœurs', siblingItems)}
          {renderSection('Enfants', childItems)}
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
