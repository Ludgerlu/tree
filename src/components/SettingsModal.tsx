/**
 * components/SettingsModal.tsx
 * Reprend openSettings()/saveSettings()/handleImport()/clearAll() de l'ancien script.js.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Member, Orientation, Settings } from '../types';
import Modal from './Modal';
import ThemePicker from './ThemePicker';

interface Props {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (s: Settings) => void;
  onImportFile: (members: Member[], settings: Settings | null) => Promise<void>;
  onExportJSON: () => void;
  onClearAll: () => Promise<void>;
}

export default function SettingsModal({ open, settings, onClose, onSave, onImportFile, onExportJSON, onClearAll }: Props) {
  const [treeName, setTreeName] = useState(settings.treeName);
  const [orientation, setOrientation] = useState<Orientation>(settings.orientation);
  const [theme, setTheme] = useState(settings.theme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTreeName(settings.treeName);
      setOrientation(settings.orientation);
      setTheme(settings.theme);
    }
  }, [open, settings]);

  const handleSave = () => {
    onSave({ treeName: treeName.trim() || 'Ma Famille', orientation, theme });
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
    if (!window.confirm('Effacer tous les membres ? Cette action est irréversible.')) return;
    try {
      await onClearAll();
      onClose();
    } catch {
      // toast déjà affiché
    }
  };

  return (
    <Modal open={open} onClose={onClose} boxStyle={{ maxWidth: 420 }}>
      <div className="modal-header">
        <h2 className="modal-title">Paramètres</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>Nom de l'arbre</label>
          <input type="text" value={treeName} onChange={(e) => setTreeName(e.target.value)} placeholder="Ma Famille" />
        </div>
        <div className="form-group">
          <label>Thème de couleur</label>
          <ThemePicker value={theme} onChange={setTheme} />
        </div>
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
          <label>Données</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>
              📥 Importer JSON
            </button>
            <button className="btn-ghost" onClick={onExportJSON}>
              📤 Exporter JSON
            </button>
            <button className="btn-danger" onClick={handleClear}>
              🗑 Tout effacer
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-primary" onClick={handleSave}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}
