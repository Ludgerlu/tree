/**
 * services/imageCompression.ts
 * Reprend la logique de compressImage() + handlePhotoFile() de l'ancien
 * index.html (compression canvas adaptative, validations HEIC / taille max).
 */

export interface PhotoCompressionResult {
  dataUrl: string;
  originalKB: number;
  newKB: number;
  pct: number;
}

function compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur lecture fichier'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image invalide'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;

        const ratio = Math.min(maxWidth / w, maxHeight / h);
        if (ratio < 1) {
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexte canvas indisponible'));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob a échoué'));
          },
          'image/jpeg',
          quality
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error('Erreur lecture du fichier compressé'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Valide, compresse (qualité adaptative selon la taille et la connexion) et
 * retourne une data URL base64 prête à être envoyée à api.php (champ `photo`).
 * Lance une Error avec un message utilisateur en cas de format/taille invalide.
 */
export async function processPhotoFile(file: File): Promise<PhotoCompressionResult> {
  const isHEIC =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);
  if (isHEIC) {
    throw new Error(
      'Format HEIC non supporté. Sur iPhone : Réglages › Appareil photo › Formats → "Le plus compatible".'
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Photo trop volumineuse (max 10 Mo). Choisissez une résolution plus faible.');
  }

  let quality = 0.82;
  let maxW = 480;
  let maxH = 600;

  if (file.size > 3 * 1024 * 1024) {
    quality = 0.7;
  } else if (file.size > 1 * 1024 * 1024) {
    quality = 0.76;
  }

  const conn = (navigator as any).connection;
  if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
    quality = 0.6;
    maxW = 360;
    maxH = 480;
  }

  const blob = await compressImage(file, maxW, maxH, quality);
  const dataUrl = await blobToDataURL(blob);
  const pct = Math.round((1 - blob.size / file.size) * 100);

  return {
    dataUrl,
    originalKB: Math.round(file.size / 1024),
    newKB: Math.round(blob.size / 1024),
    pct,
  };
}
