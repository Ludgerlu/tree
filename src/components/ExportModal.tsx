/**
 * components/ExportModal.tsx
 * Reprend openExport()/exportSVG()/exportJSON()/printTree() de l'ancien script.js.
 */
import React from 'react';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onPrint: () => void;
}

export default function ExportModal({ open, onClose, onExportSVG, onExportJSON, onPrint }: Props) {
  return (
    <Modal open={open} onClose={onClose} boxStyle={{ maxWidth: 380 }}>
      <div className="modal-header">
        <h2 className="modal-title">Exporter</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 16 }}>Choisissez le format d'export :</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            className="export-option"
            onClick={() => {
              onExportSVG();
              onClose();
            }}
          >
            <span className="exp-icon">🖼</span>
            <div>
              <strong>SVG</strong>
              <br />
              <small>Image vectorielle, qualité maximale</small>
            </div>
          </button>
          <button
            className="export-option"
            onClick={() => {
              onExportJSON();
              onClose();
            }}
          >
            <span className="exp-icon">📄</span>
            <div>
              <strong>JSON</strong>
              <br />
              <small>Données brutes, réimportables</small>
            </div>
          </button>
          <button
            className="export-option"
            onClick={() => {
              onPrint();
              onClose();
            }}
          >
            <span className="exp-icon">🖨</span>
            <div>
              <strong>Imprimer</strong>
              <br />
              <small>Mise en page pour impression</small>
            </div>
          </button>
        </div>
      </div>
    </Modal>
  );
}
