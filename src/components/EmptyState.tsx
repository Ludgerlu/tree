import React from 'react';

interface Props {
  show: boolean;
  isAuthenticated: boolean;
  onAdd: () => void;
}

export default function EmptyState({ show, isAuthenticated, onAdd }: Props) {
  return (
    <div id="empty-state" className={show ? 'show' : ''}>
      <div className="empty-icon">🌱</div>
      <p className="empty-title">Votre arbre est vide</p>
      <p className="empty-sub">Commencez par ajouter l'ancêtre fondateur de votre famille.</p>
      {isAuthenticated && (
        <button className="btn-primary" onClick={onAdd}>
          + Ajouter le premier membre
        </button>
      )}
    </div>
  );
}
