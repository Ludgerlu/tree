/**
 * components/PhotoUpload.tsx
 * Reprend la zone d'upload/compression photo de l'ancien index.html
 * (handlePhotoFile, compressImage, renderPhotoThumb, removePhoto, syncPhotoUrl).
 */
import React, { useRef, useState } from 'react';
import { processPhotoFile, PhotoCompressionResult } from '../services/imageCompression';

interface Props {
  photo: string | null;
  firstname: string;
  onChange: (photo: string | null) => void;
}

export default function PhotoUpload({ photo, firstname, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [compression, setCompression] = useState<PhotoCompressionResult | null>(null);

  const hasPhoto = !!(photo && photo.length > 4);
  const isDataUrl = !!photo && photo.startsWith('data:');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setCompression(null);
    try {
      const result = await processPhotoFile(file);
      onChange(result.dataUrl);
      setCompression(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors du traitement de la photo. Réessayez.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const remove = () => {
    onChange(null);
    setCompression(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <section className="member-photo-card" aria-label="Photo du membre">
      <div className="member-photo-cover">
        {hasPhoto ? (
          <img className="member-photo-cover-image" src={photo!} alt="" />
        ) : (
          <div className="member-photo-cover-placeholder" aria-hidden="true">
            <span>{firstname.trim() ? firstname.trim().charAt(0).toUpperCase() : '✦'}</span>
          </div>
        )}
      </div>
      <div className="member-photo-profile">
        <div className="photo-preview-thumb member-photo-avatar" style={{ opacity: loading ? 0.45 : 1 }}>
          {hasPhoto ? (
            <img
              src={photo!}
              alt="aperçu"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              onError={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) parent.textContent = '📷';
              }}
            />
          ) : firstname.trim() ? (
            firstname.trim().charAt(0).toUpperCase()
          ) : (
            '📷'
          )}
        </div>
        <div className="photo-upload-info">
          <p className="member-photo-name">{firstname.trim() || 'Nouveau membre'}</p>
          <p className="member-photo-caption">Portrait du profil familial</p>
          <div className="photo-actions">
            <button type="button" className="btn-photo-pick" onClick={() => fileInputRef.current?.click()}>
              Choisir une photo
            </button>
            {hasPhoto && (
              <button type="button" className="btn-photo-remove" style={{ display: 'flex' }} onClick={remove}>
                Retirer
              </button>
            )}
          </div>
          {compression && (
            <div>
              <div className="compression-bar-wrap">
                <div
                  className="compression-bar"
                  style={{
                    width: Math.max(4, 100 - compression.pct) + '%',
                    background:
                      compression.pct >= 50
                        ? 'var(--success)'
                        : compression.pct >= 20
                        ? 'var(--accent)'
                        : 'var(--text-light)',
                  }}
                />
              </div>
              <p className="compression-text">
                {compression.originalKB} KB → {compression.newKB} KB (−{compression.pct}%)
              </p>
            </div>
          )}
          <p className="photo-hint">JPG · PNG · max 10 Mo — compression automatique</p>
        </div>
      </div>
      {loading && (
        <div id="upload-loader" style={{ display: 'flex' }}>
          <span className="upload-spinner"></span> Compression en cours…
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <div className="member-photo-url">
        <label htmlFor="member-photo-url-input">Ou utiliser une URL de photo</label>
        <input
          id="member-photo-url-input"
          type="url"
          placeholder="https://…"
          value={hasPhoto && !isDataUrl ? photo! : ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    </section>
  );
}
