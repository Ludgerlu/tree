/**
 * components/MemberModal.tsx
 * Formulaire d'ajout/modification — reprend fillForm()/resetForm()/saveMember()/
 * confirmDelete() de l'ancien script.js.
 */
import React, { useEffect, useState } from 'react';
import { Gender, Member } from '../types';
import Modal from './Modal';
import PhotoUpload from './PhotoUpload';

interface Props {
  open: boolean;
  editingMember: Member | null;
  defaultParentId: string | null;
  members: Member[];
  onClose: () => void;
  onSave: (member: Member) => Promise<void>;
  onDelete: (id: string) => void;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyForm(parentId: string | null): Member {
  return {
    id: '',
    firstname: '',
    lastname: '',
    gender: 'M',
    birth: null,
    birthplace: null,
    death: null,
    deathplace: null,
    parentId,
    spouseId: null,
    notes: null,
    photo: null,
  };
}

export default function MemberModal({ open, editingMember, defaultParentId, members, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Member>(() => editingMember ?? emptyForm(defaultParentId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editingMember ? { ...editingMember } : emptyForm(defaultParentId));
  }, [open, editingMember, defaultParentId]);

  const isEditing = !!editingMember;

  const selectableMembers = members
    .filter((m) => m.id !== editingMember?.id)
    .slice()
    .sort((a, b) =>
      `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`, 'fr', { sensitivity: 'base' })
    );

  const set = <K extends keyof Member>(key: K, value: Member[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!form.firstname.trim() || !form.lastname.trim()) {
      alert('Prénom et nom requis');
      return;
    }
    setSaving(true);
    try {
      const payload: Member = {
        ...form,
        id: form.id || uid(),
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
      };
      await onSave(payload);
      onClose();
    } catch {
      // le toast d'erreur est déjà affiché par le contexte
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!editingMember) return;
    if (!window.confirm(`Supprimer ${editingMember.firstname} ${editingMember.lastname} ?`)) return;
    onDelete(editingMember.id);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-header">
        <h2 className="modal-title">{isEditing ? 'Modifier le membre' : 'Nouveau membre'}</h2>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <PhotoUpload photo={form.photo} firstname={form.firstname} onChange={(p) => set('photo', p)} />

        <div className="form-row two-col">
          <div className="form-group">
            <label>
              Prénom <span className="req">*</span>
            </label>
            <input type="text" value={form.firstname} placeholder="ex : Marie" onChange={(e) => set('firstname', e.target.value)} />
          </div>
          <div className="form-group">
            <label>
              Nom de famille <span className="req">*</span>
            </label>
            <input type="text" value={form.lastname} placeholder="ex : Dupont" onChange={(e) => set('lastname', e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Genre</label>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" checked={form.gender === 'M'} onChange={() => set('gender', 'M' as Gender)} /> Homme
            </label>
            <label className="radio-label">
              <input type="radio" checked={form.gender === 'F'} onChange={() => set('gender', 'F' as Gender)} /> Femme
            </label>
            <label className="radio-label">
              <input type="radio" checked={form.gender === 'N'} onChange={() => set('gender', 'N' as Gender)} /> Autre
            </label>
          </div>
        </div>

        <div className="form-row two-col">
          <div className="form-group">
            <label>Date de naissance</label>
            <input type="date" value={form.birth || ''} onChange={(e) => set('birth', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label>Lieu de naissance</label>
            <input type="text" value={form.birthplace || ''} placeholder="ex : Paris, France" onChange={(e) => set('birthplace', e.target.value || null)} />
          </div>
        </div>

        <div className="form-row two-col">
          <div className="form-group">
            <label>Date de décès</label>
            <input type="date" value={form.death || ''} onChange={(e) => set('death', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label>Lieu de décès</label>
            <input
              type="text"
              value={form.deathplace || ''}
              placeholder="Laisser vide si vivant(e)"
              onChange={(e) => set('deathplace', e.target.value || null)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Parent (père ou mère)</label>
          <select value={form.parentId || ''} onChange={(e) => set('parentId', e.target.value || null)}>
            <option value="">— Aucun (ancêtre racine) —</option>
            {selectableMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstname} {m.lastname}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Conjoint(e) (lien affiché)</label>
          <select value={form.spouseId || ''} onChange={(e) => set('spouseId', e.target.value || null)}>
            <option value="">— Aucun —</option>
            {selectableMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstname} {m.lastname}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Notes / Biographie</label>
          <textarea
            rows={3}
            placeholder="Profession, anecdotes, lieu de vie…"
            value={form.notes || ''}
            onChange={(e) => set('notes', e.target.value || null)}
          />
        </div>
      </div>
      <div className="modal-footer">
        {isEditing && (
          <button className="btn-danger" onClick={handleDelete}>
            Supprimer
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button className="btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </Modal>
  );
}
