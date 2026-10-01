/**
 * components/SettingsModal.tsx
 * Reprend openSettings()/saveSettings()/handleImport()/clearAll() de l'ancien script.js.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Member, Orientation, Settings } from '../types';
import Modal from './Modal';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (s: Settings) => void;
  onImportFile: (members: Member[], settings: Settings | null) => Promise<void>;
  onExportJSON: () => void;
  onClearAll: () => Promise<void>;
  isAuth: boolean; 
}

export default function SettingsModal({ open, settings, onClose, onSave, onImportFile, onExportJSON, onClearAll, isAuth }: Props) {
  const [treeName, setTreeName] = useState(settings.treeName);
  const [orientation, setOrientation] = useState<Orientation>(settings.orientation);
  const [visibleGenerations, setVisibleGenerations] = useState(settings.visibleGenerations);
  const [clearConfirmationOpen, setClearConfirmationOpen] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [clearing, setClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTreeName(settings.treeName);
      setOrientation(settings.orientation);
      setVisibleGenerations(settings.visibleGenerations);
      setClearConfirmationOpen(false);
      setClearConfirmationText('');
    }
  }, [open, settings]);

  const handleSave = () => {
    onSave({ treeName: treeName.trim() || 'Ma Famille', orientation, theme: settings.theme, visibleGenerations });
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      let parsed: any;
      try {
        parsed = JSON.parse(ev.target?.result as string);
      } catch {
        alert('Fichier JSON invalide');
        return;
      }
      try {
        await onImportFile(parsed.members || [], parsed.settings || null);
        onClose();
      } catch {
        // toast déjà affiché par le contexte
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = async () => {
    if (clearConfirmationText.trim().toLocaleUpperCase() !== 'EFFACER' || clearing) return;
    setClearing(true);
    try {
      await onClearAll();
      onClose();
    } catch {
      // toast déjà affiché
    } finally {
      setClearing(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} boxStyle={{ maxWidth: 420 }}>
      <div className="modal-header">
        <h2 className="modal-title">Paramètres</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        {isAuth && (  
          <div className="form-group">
            <label>Nom de l'arbre</label>
            <input type="text" value={treeName} onChange={(e) => setTreeName(e.target.value)} placeholder="Ma Famille" />
          </div>
        )}
        {isAuth && (
          <>
            <div className="form-group">
              <label>Orientation</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input type="radio" checked={orientation === 'top'} onChange={() => setOrientation('top')} /> Haut → Bas
                </label>
                <label className="radio-label">
                  <input type="radio" checked={orientation === 'left'} onChange={() => setOrientation('left')} /> Gauche → Droite
                </label>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="visible-generations">Générations visibles au départ</label>
              <select
                id="visible-generations"
                value={visibleGenerations}
                onChange={(event) => setVisibleGenerations(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>{count} génération{count > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Données (JSON)</label>
              <div className="row gap-1">
                <button type="button" className="btn-ghost col-4" onClick={() => fileInputRef.current?.click()}>
                  📥 Importer
                </button>
                <button type="button" className="btn-ghost col-4" onClick={onExportJSON}>
                  📦 Sauvegarder
                </button>
                <button type="button" className="btn-danger col-4" onClick={() => setClearConfirmationOpen(true)}>
                  Tout effacer
                </button>
              </div>
              <p className="data-backup-note">Le fichier JSON inclut les membres et paramètres et peut être réimporté pour restaurer l’arbre.</p>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          </>
        )}
        {isAuth && clearConfirmationOpen && (
          <div className="clear-confirmation" role="alertdialog" aria-labelledby="clear-confirmation-title" aria-describedby="clear-confirmation-description">
            <h3 id="clear-confirmation-title">Effacer définitivement l’arbre ?</h3>
            <p id="clear-confirmation-description">Cette action supprimera tous les membres et photos. Créez une sauvegarde JSON avant de continuer. Pour confirmer, saisissez EFFACER.</p>
            <label htmlFor="clear-confirmation-input">Saisissez EFFACER pour confirmer</label>
            <input
              id="clear-confirmation-input"
              value={clearConfirmationText}
              onChange={(event) => setClearConfirmationText(event.target.value)}
              autoComplete="off"
            />
            <div className="clear-confirmation-actions">
              <button type="button" className="btn-ghost" onClick={() => setClearConfirmationOpen(false)}>Annuler</button>
              <button
                type="button"
                className="btn-danger"
                disabled={clearConfirmationText.trim().toLocaleUpperCase() !== 'EFFACER' || clearing}
                onClick={handleClear}
              >
                {clearing ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn-primary" onClick={handleSave}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
