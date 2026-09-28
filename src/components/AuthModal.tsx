/**
 * components/AuthModal.tsx
 * Reprend openAuthModal()/submitAuth() de l'ancien script.js.
 */
import React, { useEffect, useState } from 'react';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string, password: string) => Promise<void>;
}

export default function AuthModal({ open, onClose, onSubmit }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUsername('');
      setPassword('');
      setError('');
    }
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nom d\u2019utilisateur ou mot de passe incorrect.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} boxStyle={{ maxWidth: 420 }}>
      <div className="modal-header">
        <h2 className="modal-title">Connexion requise</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <p>Pour ajouter un membre, connectez-vous avec votre identifiant.</p>
        <div className="form-group">
          <label>Nom d'utilisateur</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ex: Evina"
            autoComplete="username"
          />
        </div>
        <div className="form-group">
          <label>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </div>
        <div className="auth-error">{error}</div>
      </div>
      <div className="modal-footer">
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? 'Connexion…' : 'Se connecter'}
        </button>
      </div>
    </Modal>
  );
}
