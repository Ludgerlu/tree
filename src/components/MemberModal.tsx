/**
 * components/MemberModal.tsx
 * Formulaire d'ajout/modification — reprend fillForm()/resetForm()/saveMember()/
 * confirmDelete() de l'ancien script.js.
 */
import React, { useEffect, useRef, useState } from 'react';
import Select from 'react-select';
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

interface MemberOption {
  value: string;
  label: string;
}

export default function MemberModal({ open, editingMember, defaultParentId, members, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState<Member>(() => editingMember ?? emptyForm(defaultParentId));
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ firstname?: string; lastname?: string }>({});
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setForm(editingMember ? { ...editingMember } : emptyForm(defaultParentId));
    setFieldErrors({});
    setSaveError('');
  }, [open, editingMember, defaultParentId]);

  const isEditing = !!editingMember;

  const selectableMembers = members
    .filter((m) => m.id !== editingMember?.id)
    .slice()
    .sort((a, b) =>
      `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`, 'fr', { sensitivity: 'base' })
    );
  const memberOptions: MemberOption[] = selectableMembers.map((member) => ({
    value: member.id,
    label: `${member.firstname} ${member.lastname}`,
  }));

  const set = <K extends keyof Member>(key: K, value: Member[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingRef.current) return;

    const errors = {
      ...(!form.firstname.trim() ? { firstname: 'Le prénom est requis.' } : {}),
      ...(!form.lastname.trim() ? { lastname: 'Le nom de famille est requis.' } : {}),
    };
    setFieldErrors(errors);
    setSaveError('');
    if (Object.keys(errors).length > 0) return;

    savingRef.current = true;
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
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Enregistrement impossible. Veuillez réessayer.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const updateField = <K extends keyof Member>(key: K, value: Member[K]) => {
    set(key, value);
    if (key === 'firstname' || key === 'lastname') {
      setFieldErrors((current) => ({ ...current, [key]: undefined }));
    }
    setSaveError('');
  };

  const handleDelete = () => {
    if (!editingMember) return;
    if (!window.confirm(`Supprimer ${editingMember.firstname} ${editingMember.lastname} ?`)) return;
    onDelete(editingMember.id);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <form className="member-form" onSubmit={handleSave} noValidate>
        <div className="modal-header">
          <h2 className="modal-title">{isEditing ? 'Modifier le membre' : 'Nouveau membre'}</h2>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <PhotoUpload photo={form.photo} firstname={form.firstname} onChange={(p) => updateField('photo', p)} />

          <div className="form-row two-col">
            <div className="form-group">
              <label htmlFor="member-firstname">
                Prénom <span className="req">*</span>
              </label>
              <input
                id="member-firstname"
                type="text"
                required
                aria-invalid={!!fieldErrors.firstname}
                aria-describedby={fieldErrors.firstname ? 'member-firstname-error' : undefined}
                value={form.firstname}
                placeholder="ex : Marie"
                onChange={(e) => updateField('firstname', e.target.value)}
              />
              {fieldErrors.firstname && <p id="member-firstname-error" className="field-error">{fieldErrors.firstname}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="member-lastname">
                Nom de famille <span className="req">*</span>
              </label>
              <input
                id="member-lastname"
                type="text"
                required
                aria-invalid={!!fieldErrors.lastname}
                aria-describedby={fieldErrors.lastname ? 'member-lastname-error' : undefined}
                value={form.lastname}
                placeholder="ex : Dupont"
                onChange={(e) => updateField('lastname', e.target.value)}
              />
              {fieldErrors.lastname && <p id="member-lastname-error" className="field-error">{fieldErrors.lastname}</p>}
            </div>
          </div>

          <div className="form-group">
            <label>Genre</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" checked={form.gender === 'M'} onChange={() => updateField('gender', 'M' as Gender)} /> Homme
              </label>
              <label className="radio-label">
                <input type="radio" checked={form.gender === 'F'} onChange={() => updateField('gender', 'F' as Gender)} /> Femme
              </label>
              <label className="radio-label">
                <input type="radio" checked={form.gender === 'N'} onChange={() => updateField('gender', 'N' as Gender)} /> Autre
              </label>
            </div>
          </div>

          <div className="form-row two-col">
            <div className="form-group">
              <label htmlFor="member-birth">Date de naissance</label>
              <input id="member-birth" type="date" value={form.birth || ''} onChange={(e) => updateField('birth', e.target.value || null)} />
            </div>
            <div className="form-group">
              <label htmlFor="member-birthplace">Lieu de naissance</label>
              <input id="member-birthplace" type="text" value={form.birthplace || ''} placeholder="ex : Paris, France" onChange={(e) => updateField('birthplace', e.target.value || null)} />
            </div>
          </div>

          <div className="form-row two-col">
            <div className="form-group">
              <label htmlFor="member-death">Date de décès</label>
              <input id="member-death" type="date" value={form.death || ''} onChange={(e) => updateField('death', e.target.value || null)} />
            </div>
            <div className="form-group">
              <label htmlFor="member-deathplace">Lieu de décès</label>
              <input
                id="member-deathplace"
                type="text"
                value={form.deathplace || ''}
                placeholder="Laisser vide si vivant(e)"
                onChange={(e) => updateField('deathplace', e.target.value || null)}
              />
            </div>
          </div>

          <div className="form-group">
            <label id="member-parent-label" htmlFor="member-parent-input">Parent (père ou mère)</label>
            <Select<MemberOption, false>
              inputId="member-parent-input"
              instanceId="member-parent-select"
              classNamePrefix="member-select"
              aria-labelledby="member-parent-label"
              options={memberOptions}
              value={memberOptions.find((option) => option.value === form.parentId) ?? null}
              onChange={(option) => updateField('parentId', option?.value ?? null)}
              isClearable
              isSearchable
              placeholder="Rechercher un parent…"
              noOptionsMessage={({ inputValue }) => inputValue ? 'Aucun membre trouvé' : 'Aucun membre disponible'}
              menuPortalTarget={document.body}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 300 }) }}
            />
          </div>

          <div className="form-group">
            <label id="member-spouse-label" htmlFor="member-spouse-input">Conjoint(e) (lien affiché)</label>
            <Select<MemberOption, false>
              inputId="member-spouse-input"
              instanceId="member-spouse-select"
              classNamePrefix="member-select"
              aria-labelledby="member-spouse-label"
              options={memberOptions}
              value={memberOptions.find((option) => option.value === form.spouseId) ?? null}
              onChange={(option) => updateField('spouseId', option?.value ?? null)}
              isClearable
              isSearchable
              placeholder="Rechercher un conjoint…"
              noOptionsMessage={({ inputValue }) => inputValue ? 'Aucun membre trouvé' : 'Aucun membre disponible'}
              menuPortalTarget={document.body}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 300 }) }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="member-notes">Notes / Biographie</label>
            <textarea
              id="member-notes"
              rows={3}
              placeholder="Profession, anecdotes, lieu de vie…"
              value={form.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
            />
          </div>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
        </div>
        <div className="modal-footer">
          {isEditing && (
            <button type="button" className="btn-danger" onClick={handleDelete}>
              Supprimer
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
