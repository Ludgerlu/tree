import React, { useEffect, useMemo, useState } from 'react';
import { Member } from '../types';
import { Album, api, GalleryImage } from '../services/api';
import { processGalleryImage } from '../services/imageCompression';
import Modal from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  members: Member[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  showToast: (message: string) => void;
}

type GalleryTab = 'albums' | 'family';

export default function GalleryModal({ open, onClose, members, isAuthenticated, isAdmin, showToast }: Props) {
  const [tab, setTab] = useState<GalleryTab>('albums');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [familyPhotos, setFamilyPhotos] = useState<GalleryImage[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<number | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [albumDate, setAlbumDate] = useState('');
  const [editingAlbum, setEditingAlbum] = useState(false);
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [familyStory, setFamilyStory] = useState('');
  const [familyYear, setFamilyYear] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadCount, setUploadCount] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const eligibleFamilyMembers = useMemo(() => members.filter((member) => members.some((child) => child.parentId === member.id)), [members]);
  const visibleImages = selectedAlbum ? images.filter((image) => image.albumId === selectedAlbum) : images;
  const selectedAlbumDetails = selectedAlbum ? albums.find((album) => album.id === selectedAlbum) ?? null : null;
  const selectedImage = visibleImages.find((image) => image.id === selectedImageId) ?? visibleImages[0] ?? null;

  const loadGallery = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getGallery();
      setAlbums(data.albums);
      setImages(data.images);
      setFamilyPhotos(data.familyPhotos);
      setSelectedAlbum((current) => current && data.albums.some((album) => album.id === current) ? current : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger la galerie.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setTab('albums');
    setEditingAlbum(false);
    setError('');
    setNotice('');
    void loadGallery();
  }, [open]);

  useEffect(() => {
    if (!selectedAlbumDetails || editingAlbum) return;
    setAlbumTitle(selectedAlbumDetails.title);
    setAlbumDescription(selectedAlbumDetails.description || '');
    setAlbumDate(selectedAlbumDetails.eventDate || '');
  }, [selectedAlbumDetails, editingAlbum]);

  const handleCreateAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!albumTitle.trim() || uploading) return;
    setUploading(true);
    setError('');
    try {
      const result = await api.createAlbum({ title: albumTitle.trim(), description: albumDescription.trim(), eventDate: albumDate });
      setAlbumTitle('');
      setAlbumDescription('');
      setAlbumDate('');
      setSelectedAlbum(result.album.id);
      setSelectedImageId(null);
      setNotice(result.message);
      await loadGallery();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'La création de l’album a échoué.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateAlbum = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAlbum || !albumTitle.trim() || savingAlbum) return;
    setSavingAlbum(true);
    setError('');
    try {
      const result = await api.updateAlbum(selectedAlbum, {
        title: albumTitle.trim(),
        description: albumDescription.trim(),
        eventDate: albumDate,
      });
      setAlbums((current) => current.map((album) => album.id === result.album.id ? result.album : album));
      setNotice(result.message);
      setEditingAlbum(false);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'La modification de l’album a échoué.');
    } finally {
      setSavingAlbum(false);
    }
  };

  const handleAlbumFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const albumId = selectedAlbum;
    event.target.value = '';
    if (!albumId || files.length === 0 || uploading) return;
    setUploading(true);
    setError('');
    let saved = 0;
    let reducedBytes = 0;
    setUploadCount({ current: 0, total: files.length });
    try {
      for (let index = 0; index < files.length; index += 1) {
        setUploadProgress(`Compression et envoi ${index + 1} / ${files.length}`);
        const compressed = await processGalleryImage(files[index]);
        reducedBytes += Math.max(0, files[index].size - compressed.file.size);
        await api.uploadAlbumImage(albumId, compressed.file);
        saved += 1;
        setUploadCount({ current: saved, total: files.length });
      }
      showToast(`${saved} photo${saved > 1 ? 's' : ''} optimisée${saved > 1 ? 's' : ''} · ${Math.round(reducedBytes / 1024)} Ko économisés`);
      setNotice('Photos ajoutées à l’album.');
      await loadGallery();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : `Envoi interrompu après ${saved} photo(s).`);
      if (saved > 0) await loadGallery();
    } finally {
      setUploading(false);
      setUploadProgress('');
      setUploadCount({ current: 0, total: 0 });
    }
  };

  const handleFamilyPhoto = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('family-photo-file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !familyMemberId || uploading) return;
    setUploading(true);
    setError('');
    setUploadProgress('Compression et envoi…');
    setUploadCount({ current: 0, total: 1 });
    try {
      const compressed = await processGalleryImage(file);
      const uploaded = await api.uploadFamilyPhoto(compressed.file);
      const saved = await api.addFamilyPhoto({
        memberId: familyMemberId,
        photoFile: uploaded.file,
        histoire: familyStory.trim(),
        annee: familyYear.trim(),
      });
      setUploadCount({ current: 1, total: 1 });
      setFamilyPhotos((current) => [saved.photo, ...current]);
      setFamilyStory('');
      setFamilyYear('');
      if (input) input.value = '';
      showToast(compressed.pct > 0
        ? `${compressed.originalKB} Ko → ${compressed.newKB} Ko (${compressed.pct}% économisés)`
        : `Photo optimisée · ${compressed.newKB} Ko`);
      setNotice(saved.message);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'L’ajout de la photo a échoué.');
    } finally {
      setUploading(false);
      setUploadProgress('');
      setUploadCount({ current: 0, total: 0 });
    }
  };

  const renderUploadProgress = () => {
    if (!uploading || uploadCount.total === 0) return null;
    const percentage = Math.round((uploadCount.current / uploadCount.total) * 100);
    return <div className="gallery-upload-progress" role="status" aria-live="polite">
      <div className="gallery-upload-progress-label">
        <span>{uploadProgress}</span>
        <strong>{uploadCount.current} / {uploadCount.total}</strong>
      </div>
      <div className="gallery-upload-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={uploadCount.total} aria-valuenow={uploadCount.current} aria-label="Progression de l’envoi">
        <span style={{ width: `${percentage}%` }} />
      </div>
    </div>;
  };

  const removeAlbumImage = async (image: GalleryImage) => {
    if (!window.confirm('Supprimer cette photo de l’album ?')) return;
    try {
      await api.deleteAlbumImage(image.id);
      setImages((current) => current.filter((item) => item.id !== image.id));
      setAlbums((current) => current.map((album) => album.id === image.albumId ? { ...album, imageCount: Math.max(0, album.imageCount - 1) } : album));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Suppression impossible.');
    }
  };

  const removeAlbum = async (album: Album) => {
    if (!window.confirm(`Supprimer l’album « ${album.title} » et toutes ses photos ?`)) return;
    try {
      await api.deleteAlbum(album.id);
      setAlbums((current) => current.filter((item) => item.id !== album.id));
      setImages((current) => current.filter((image) => image.albumId !== album.id));
      setSelectedAlbum(null);
      setSelectedImageId(null);
      setNotice('Album supprimé.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Suppression impossible.');
    }
  };

  const removeFamilyPhoto = async (photo: GalleryImage) => {
    if (!window.confirm('Supprimer cette photo de famille ?')) return;
    try {
      await api.deleteFamilyPhoto(photo.id);
      setFamilyPhotos((current) => current.filter((item) => item.id !== photo.id));
      setNotice('Photo de famille supprimée.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Suppression impossible.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} className={`gallery-modal${selectedAlbum ? ' gallery-modal-detail' : ''}`} overlayClassName="gallery-overlay">
      <div className={`gallery-header${selectedAlbum ? ' gallery-detail-header' : ''}`}>
        {selectedAlbum && <button type="button" className="gallery-return-button" onClick={() => { setSelectedAlbum(null); setSelectedImageId(null); }} aria-label="Retour aux albums">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          <span>Retour aux albums</span>
        </button>}
        {editingAlbum ? <div className="gallery-header-editing-title"><span>MODIFIER L’ALBUM</span><strong>{selectedAlbumDetails?.title}</strong></div> : <div>
          {/* <p className="gallery-eyebrow">{selectedAlbum ? 'SOUVENIR DE FAMILLE' : 'SOUVENIRS DE FAMILLE'}</p> */}
          <h2>{selectedAlbumDetails?.title || 'Galerie'}</h2>
        </div>}
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer la galerie">×</button>
      </div>
      {!selectedAlbum && <div className="gallery-tabs" role="tablist" aria-label="Types de photos">
        <button type="button" role="tab" aria-selected={tab === 'albums'} className={tab === 'albums' ? 'active' : ''} onClick={() => { setTab('albums'); setError(''); }}>Albums d’événements</button>
        <button type="button" role="tab" aria-selected={tab === 'family'} className={tab === 'family' ? 'active' : ''} onClick={() => { setTab('family'); setError(''); }}>Photos de famille</button>
      </div>}
      {(error || notice) && <div className="gallery-alerts">
        {error && <div className="alert alert-danger alert-dismissible fade show gallery-flash-alert" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')} aria-label="Fermer l’alerte" />
        </div>}
        {notice && <div className="alert alert-success alert-dismissible fade show gallery-flash-alert" role="status">
          {notice}
          <button type="button" className="btn-close" onClick={() => setNotice('')} aria-label="Fermer l’alerte" />
        </div>}
      </div>}
      {renderUploadProgress()}
      <div className="gallery-content">
        {loading ? <p className="gallery-empty">Chargement de la galerie…</p> : tab === 'albums' ? <>
          {isAdmin && !selectedAlbum && (
            <form className="gallery-create-album" onSubmit={handleCreateAlbum}>
              <h3>Créer un album d’événement</h3>
              <div className="gallery-form-grid">
                <label>Titre<input required maxLength={120} value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} placeholder="Anniversaire, réunion…" /></label>
                <label>Date<input type="date" value={albumDate} onChange={(event) => setAlbumDate(event.target.value)} /></label>
              </div>
              <label>Description<textarea rows={2} maxLength={1000} value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} placeholder="Un petit mot sur l’événement" /></label>
              <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Création…' : 'Créer l’album'}</button>
            </form>
          )}
          {selectedAlbum ? <>
            {editingAlbum && isAdmin ? <form className="gallery-edit-album" onSubmit={handleUpdateAlbum}>
              <h3>Informations de l’événement</h3>
              <label>Nom de l’album<input required maxLength={120} value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} /></label>
              <label>Date de l’événement<input type="date" value={albumDate} onChange={(event) => setAlbumDate(event.target.value)} /></label>
              <label>Description<textarea rows={4} maxLength={1000} value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} /></label>
              <div className="gallery-edit-actions">
                <button type="button" className="btn-ghost" onClick={() => { setEditingAlbum(false); setError(''); }}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={savingAlbum}>{savingAlbum ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </form> : <section className="gallery-viewer" aria-label={`Photos de ${selectedAlbumDetails?.title || 'l’album'}`}>
              {selectedImage ? <>
                <div className="gallery-viewer-photo-wrap">
                  <img className="gallery-viewer-photo" src={selectedImage.photo} alt={selectedImage.caption || selectedAlbumDetails?.title || 'Photo de l’album'} />
                  {isAdmin && <button type="button" className="gallery-viewer-delete" onClick={() => void removeAlbumImage(selectedImage)} aria-label="Supprimer cette photo">Supprimer</button>}
                </div>
                <div className="gallery-viewer-caption">
                  <span>{selectedAlbumDetails?.eventDate || 'Date non renseignée'}</span>
                  {selectedImage.caption && <p>{selectedImage.caption}</p>}
                </div>
                <div className="gallery-viewer-filmstrip" aria-label="Photos de cet album">
                  {visibleImages.map((image, index) => <button
                    type="button"
                    className={`gallery-viewer-thumb${selectedImage.id === image.id ? ' active' : ''}`}
                    key={image.id}
                    onClick={() => setSelectedImageId(image.id)}
                    aria-label={`Afficher la photo ${index + 1}`}
                    aria-pressed={selectedImage.id === image.id}
                  >
                    <img src={image.photo} alt="" loading="lazy" />
                  </button>)}
                </div>
              </> : <div className="gallery-viewer-empty">
                <p>Aucune photo dans cet album pour le moment.</p>
                {isAdmin && <label className={`gallery-upload-button${uploading ? ' disabled' : ''}`}>
                  <span>{uploading ? uploadProgress : 'Ajouter des photos'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={handleAlbumFiles} />
                </label>}
              </div>}
              <div className="gallery-viewer-actions">
                {isAdmin && selectedAlbumDetails && <button type="button" className="gallery-edit-album-button" onClick={() => setEditingAlbum(true)} aria-label="Modifier les informations de l’album">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                  Modifier l’album
                </button>}
                {isAdmin && <label className={`gallery-upload-button${uploading ? ' disabled' : ''}`}>
                  <span>{uploading ? uploadProgress : 'Ajouter des photos'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={handleAlbumFiles} />
                </label>}
                {isAdmin && selectedAlbumDetails && <button type="button" className="gallery-delete-album" onClick={() => void removeAlbum(selectedAlbumDetails)}>Supprimer l’album</button>}
              </div>
            </section>}
          </> : <div className="gallery-album-grid">
            {albums.map((album) => {
              const albumImages = images.filter((image) => image.albumId === album.id);
              const cover = albumImages[0];
              return <button type="button" className="gallery-album-card" key={album.id} onClick={() => { setSelectedAlbum(album.id); setSelectedImageId(null); }}>
                <span className="gallery-album-cover">
                  {cover ? <img src={cover.photo} alt="" loading="lazy" /> : <span className="gallery-album-placeholder" aria-hidden="true">✦</span>}
                </span>
                <span className="gallery-album-previews" aria-hidden="true">
                  {[0, 1, 2].map((previewIndex) => {
                    const preview = albumImages[previewIndex + 1];
                    return <span className="gallery-album-preview" key={previewIndex}>
                      {preview ? <img src={preview.photo} alt="" loading="lazy" /> : <span className="gallery-album-preview-empty" />}
                    </span>;
                  })}
                </span>
                <span className="gallery-album-card-footer">
                  <span className="gallery-album-copy"><strong>{album.title}</strong><small>{album.eventDate || 'Événement'}</small></span>
                  <span className="gallery-album-count" aria-label={`${album.imageCount} photos`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>
                    {album.imageCount}
                  </span>
                </span>
              </button>;
            })}
            {!albums.length && <p className="gallery-empty">Aucun album pour l’instant.</p>}
          </div>}
        </> : <>
          {isAuthenticated && <form className="gallery-family-form" onSubmit={handleFamilyPhoto}>
            <h3>Ajouter une photo de famille</h3>
            <label>Famille<select required value={familyMemberId} onChange={(event) => setFamilyMemberId(event.target.value)}>
              <option value="">Choisir un parent</option>
              {eligibleFamilyMembers.map((member) => <option value={member.id} key={member.id}>{member.firstname} {member.lastname}</option>)}
            </select></label>
            <div className="gallery-form-grid">
              <label>Année<input value={familyYear} onChange={(event) => setFamilyYear(event.target.value)} placeholder="ex. 1998" maxLength={40} /></label>
              <label>Image<input name="family-photo-file" type="file" accept="image/jpeg,image/png,image/webp" required disabled={uploading} /></label>
            </div>
            <label>Légende<textarea rows={2} value={familyStory} onChange={(event) => setFamilyStory(event.target.value)} maxLength={1000} placeholder="Qui est sur la photo ? Quel souvenir ?" /></label>
            <button type="submit" className="btn-primary" disabled={uploading || eligibleFamilyMembers.length === 0}>{uploading ? uploadProgress : 'Enregistrer la photo'}</button>
            {!eligibleFamilyMembers.length && <small className="gallery-hint">Ajoutez d’abord un parent et au moins un enfant dans l’arbre.</small>}
          </form>}
          {!isAuthenticated && <p className="gallery-hint">Connectez-vous pour ajouter une photo de famille.</p>}
          <div className="gallery-photo-grid family-gallery-grid">
            {familyPhotos.map((image) => {
              const member = members.find((item) => item.id === image.memberId);
              return <figure className="gallery-family-photo" key={image.id}>
                <img src={image.photo} alt={image.histoire || 'Photo de famille'} loading="lazy" />
                <figcaption><strong>{image.histoire || (member ? `${member.firstname} ${member.lastname}` : 'Photo de famille')}</strong><small>{image.annee || member?.firstname || ''}</small></figcaption>
                {isAuthenticated && <button type="button" className="gallery-photo-delete" onClick={() => void removeFamilyPhoto(image)} aria-label="Supprimer cette photo de famille">×</button>}
              </figure>;
            })}
          </div>
          {!familyPhotos.length && <p className="gallery-empty">Aucune photo de famille pour le moment.</p>}
        </>}
      </div>
    </Modal>
  );
}
