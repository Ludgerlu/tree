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
  isAuthenticated: boolean;
  account: { displayName: string; username: string; role: string } | null;
  onSaveProfile: (displayName: string) => Promise<void>;
  treeName: string;
  onEditMember: (id: string) => void;
  onViewTree: () => void;
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

export default function MemberModal({ open, editingMember, defaultParentId, members, onClose, onSave, onDelete, isAuthenticated, account, onSaveProfile, treeName, onEditMember, onViewTree }: Props) {
  const [form, setForm] = useState<Member>(() => editingMember ?? emptyForm(defaultParentId));
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ firstname?: string; lastname?: string }>({});
  const [saveError, setSaveError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(account?.displayName ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [activeTab, setActiveTab] = useState<'form' | 'members'>('form');
  const [memberSearch, setMemberSearch] = useState('');
  const [familySlideIndex, setFamilySlideIndex] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setForm(editingMember ? { ...editingMember } : emptyForm(defaultParentId));
    setFieldErrors({});
    setSaveError('');
    setProfileName(account?.displayName ?? '');
    setEditingProfile(false);
    setProfileError('');
    setActiveTab(isAuthenticated ? 'form' : 'members');
    setMemberSearch('');
    setFamilySlideIndex(0);
  }, [open, editingMember, defaultParentId, account?.displayName, isAuthenticated]);

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
  const visibleMembers = members
    .filter((member) => `${member.firstname} ${member.lastname}`.toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase()))
    .slice()
    .sort((first, second) => `${first.firstname} ${first.lastname}`.localeCompare(`${second.firstname} ${second.lastname}`, 'fr', { sensitivity: 'base' }));
  const profileParent = members.find((member) => member.id === form.parentId) ?? null;
  const profileSpouse = members.find((member) => member.id === form.spouseId) ?? null;
  const profileChildren = form.id ? members.filter((member) => member.parentId === form.id) : [];
  const familyConnections = [
    ...(profileParent ? [{ label: profileParent.gender === 'F' ? 'Mère' : 'Père', member: profileParent }] : []),
    ...(profileSpouse ? [{ label: 'Conjoint(e)', member: profileSpouse }] : []),
    ...profileChildren.map((member) => ({ label: member.gender === 'F' ? 'Fille' : 'Fils', member })),
  ];
  const familySlides = [
    ...(profileParent ? [{ label: profileParent.gender === 'F' ? 'Mère' : 'Père', member: profileParent }] : []),
    ...members
      .filter((member) => member.id !== form.id && !!form.parentId && member.parentId === form.parentId)
      .map((member) => ({ label: member.gender === 'F' ? 'Sœur' : 'Frère', member })),
  ];
  const renderedFamilySlides = familySlides.length > 1
    ? [...familySlides, ...familySlides.slice(0, Math.min(2, familySlides.length))]
    : familySlides;
  const activeFamilySlide = familySlides.length ? familySlideIndex % familySlides.length : 0;

  useEffect(() => {
    if (familySlides.length < 2) return;
    const timer = window.setInterval(() => {
      setFamilySlideIndex((index) => (index + 1) % familySlides.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [familySlides.length, form.parentId, form.id]);

  const showFamilySlide = (index: number) => {
    setFamilySlideIndex((index + familySlides.length) % familySlides.length);
  };

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

  const handleProfileSave = async () => {
    const trimmedName = profileName.trim();
    if (!trimmedName || trimmedName.length > 80) {
      setProfileError('Le nom affiché doit contenir entre 1 et 80 caractères.');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      await onSaveProfile(trimmedName);
      setEditingProfile(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Modification du profil impossible.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} boxStyle={{ maxWidth: 520 }} className="member-edit-modal member-side-panel" overlayClassName="side-panel-overlay">
      <form className="member-form d-flex flex-column" onSubmit={handleSave} noValidate>
        <header className="tree-sidebar-header">
          <button type="button" className="sidebar-icon-button sidebar-collapse-button" onClick={onViewTree} aria-label="Réduire le panneau" title="Réduire">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /><path d="M19 6v12" /></svg>
          </button>
          <div className="tree-sidebar-heading">
            {editingProfile && account ? (
              <label className="side-panel-profile-edit"><span className="visually-hidden">Nom affiché</span><input maxLength={80} value={profileName} onChange={(event) => setProfileName(event.target.value)} autoFocus /></label>
            ) : <strong>{isAuthenticated && account ? account.displayName : treeName}</strong>}
            <span>{members.length} membre{members.length === 1 ? '' : 's'}</span>
          </div>
          {isAuthenticated && account && (editingProfile ? (
            <div className="side-panel-profile-actions">
              <button type="button" className="btn-ghost" onClick={() => { setEditingProfile(false); setProfileName(account.displayName); setProfileError(''); }}>Annuler</button>
              <button type="button" className="btn-primary" onClick={handleProfileSave} disabled={profileSaving}>{profileSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          ) : (
            <button type="button" className="side-panel-edit-profile" onClick={() => setEditingProfile(true)} title="Modifier le nom affiché" aria-label="Modifier le nom affiché">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
            </button>
          ))}
          {/* <button type="button" className="sidebar-tree-button" onClick={onViewTree}>
            Voir l'arbre <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </button> */}
          
        </header>
        {isAuthenticated && (
          <div className="tree-sidebar-tabs" role="tablist" aria-label="Panneau de l'arbre">
            <button type="button" role="tab" aria-selected={activeTab === 'form'} className={activeTab === 'form' ? 'active' : ''} onClick={() => setActiveTab('form')}>
              {isEditing ? 'Modifier' : 'Ajouter'}
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'members'} className={activeTab === 'members' ? 'active' : ''} onClick={() => setActiveTab('members')}>
              Membres ({members.length})
            </button>
          </div>
        )}
        {profileError && <p className="sidebar-profile-error" role="alert">{profileError}</p>}
        {isAuthenticated && activeTab === 'form' ? <>
        <div className="tree-sidebar-form-heading member-editor-heading">
          <div>
            <span className="member-editor-kicker">{isEditing ? 'PROFIL FAMILIAL' : 'NOUVEAU PROFIL'}</span>
            <h2>{isEditing ? `Modifier ${form.firstname || 'le membre'}` : 'Nouveau membre'}</h2>
          </div>
          <span>{isEditing ? 'Modification' : 'Création'}</span>
        </div>
        <div className="modal-body member-modal-body">
          <PhotoUpload photo={form.photo} firstname={form.firstname} onChange={(p) => updateField('photo', p)} />

          <section className="member-profile-overview" aria-label="Résumé du membre">
            <div className="member-profile-stats">
              <div className="member-profile-stat"><span>Naissance</span><strong>{form.birth ? form.birth.slice(0, 4) : '—'}</strong></div>
              <div className="member-profile-stat"><span>Genre</span><strong>{form.gender === 'F' ? 'Femme' : form.gender === 'M' ? 'Homme' : 'Autre'}</strong></div>
              <div className="member-profile-stat"><span>Liens</span><strong>{familyConnections.length}</strong></div>
            </div>
            <section className="member-profile-connections" aria-label="Parents et fratrie">
              <div className="member-profile-connections-heading">
                <div>
                  <h3>Parents et fratrie</h3>
                  <span>{familySlides.length} membre{familySlides.length === 1 ? '' : 's'}</span>
                </div>
                {familySlides.length > 1 && <div className="member-family-carousel-controls">
                  <button type="button" onClick={() => showFamilySlide(activeFamilySlide - 1)} aria-label="Membres précédents">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <button type="button" onClick={() => showFamilySlide(activeFamilySlide + 1)} aria-label="Membres suivants">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                </div>}
              </div>
              {familySlides.length ? <>
                <div className="member-family-carousel-window">
                  <div className="member-family-carousel-track" style={{ transform: `translateX(-${activeFamilySlide * 148}px)` }}>
                    {renderedFamilySlides.map(({ label, member }, index) => (
                    <div className="member-profile-connection" key={`${label}-${member.id}-${index}`}>
                      <div className="member-profile-connection-photo">
                        {member.photo ? <img src={member.photo} alt={`${member.firstname} ${member.lastname}`} /> : <span>{`${member.firstname.slice(0, 1)}${member.lastname.slice(0, 1)}`.toLocaleUpperCase()}</span>}
                      </div>
                      <div className="member-profile-connection-copy"><strong>{member.firstname} {member.lastname}</strong><small>{label}</small></div>
                    </div>
                    ))}
                  </div>
                </div>
                {familySlides.length > 1 && <div className="member-family-carousel-dots" aria-label={`Membre ${activeFamilySlide + 1} sur ${familySlides.length}`}>
                  {familySlides.map((slide, index) => <button type="button" key={`${slide.label}-${slide.member.id}`} className={index === activeFamilySlide ? 'active' : ''} onClick={() => showFamilySlide(index)} aria-label={`Afficher ${slide.member.firstname} ${slide.member.lastname}`} />)}
                </div>}
              </> : <p className="member-profile-no-connections">Choisissez un parent pour afficher ses enfants et leur fratrie.</p>}
            </section>
          </section>

          <section className="member-form-section">
            <h3 className="member-section-title">Identité</h3>
            <div className="row g-3">
            <div className="col-12 col-sm-6">
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
            </div>
            <div className="col-12 col-sm-6">
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
          </div>

            <div className="form-group member-gender-group">
              <label>Genre</label>
              <div className="d-flex flex-wrap gap-3 mt-1">
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
          </section>

          <section className="member-form-section">
            <h3 className="member-section-title">Dates et lieux</h3>
            <div className="row g-3">
            <div className="col-12 col-sm-6">
              <div className="form-group">
              <label htmlFor="member-birth">Date de naissance</label>
              <input id="member-birth" type="date" value={form.birth || ''} onChange={(e) => updateField('birth', e.target.value || null)} />
              </div>
            </div>
            <div className="col-12 col-sm-6">
              <div className="form-group">
              <label htmlFor="member-birthplace">Lieu de naissance</label>
              <input id="member-birthplace" type="text" value={form.birthplace || ''} placeholder="ex : Paris, France" onChange={(e) => updateField('birthplace', e.target.value || null)} />
              </div>
            </div>
          </div>

            <div className="row g-3">
            <div className="col-12 col-sm-6">
              <div className="form-group">
              <label htmlFor="member-death">Date de décès</label>
              <input id="member-death" type="date" value={form.death || ''} onChange={(e) => updateField('death', e.target.value || null)} />
              </div>
            </div>
            <div className="col-12 col-sm-6">
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
          </div>
          </section>

          <section className="member-form-section">
            <h3 className="member-section-title">Liens familiaux</h3>
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
          </section>

          <section className="member-form-section">
            <h3 className="member-section-title">À propos</h3>
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
          </section>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
        </div>
        <div className="modal-footer member-editor-footer">
          {isEditing && (
            <button type="button" className="btn-danger member-editor-delete" onClick={handleDelete}>
              Supprimer
            </button>
          )}
          <button type="button" className="btn-ghost member-editor-cancel" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn-primary member-editor-save" disabled={saving}>
            {saving ? 'Enregistrement…' : isEditing ? 'Enregistrer les modifications' : 'Créer le profil'}
          </button>
        </div>
        </> : <section className="tree-sidebar-members" role="tabpanel">
          <label className="tree-sidebar-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
            <span className="visually-hidden">Rechercher un membre</span>
            <input type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Rechercher un membre" />
          </label>
          <div className="tree-sidebar-member-list">
            {visibleMembers.length ? visibleMembers.map((member) => (
              <button type="button" className="tree-sidebar-member" key={member.id} onClick={() => onEditMember(member.id)} aria-label={`${isAuthenticated ? 'Modifier' : 'Voir'} ${member.firstname} ${member.lastname}`}>
                <span className="tree-sidebar-member-avatar">{`${member.firstname.slice(0, 1)}${member.lastname.slice(0, 1)}`.toLocaleUpperCase()}</span>
                <span><strong>{member.firstname} {member.lastname}</strong><small>Membre</small></span>
              </button>
            )) : <p className="tree-sidebar-empty">Aucun membre trouvé.</p>}
          </div>
        </section>}
      </form>
    </Modal>
  );
}
