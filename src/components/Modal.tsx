/**
 * components/Modal.tsx
 * Overlay générique — reprend le comportement des .modal-overlay de l'ancien
 * index.html (clic sur l'overlay = fermeture, touche Échap = fermeture).
 */
import React, { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  className?: string;
  boxStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, className, boxStyle, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className={`modal-box ${className || ''}`.trim()} style={boxStyle}>
        {children}
      </div>
    </div>
  );
}
