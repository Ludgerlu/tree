/**
 * services/api.ts
 * Pont vers api.php — reprend fidèlement la fonction apiCall() de l'ancien script.js.
 * api.php n'est pas modifié : on lui parle exactement comme avant (action + JSON).
 */
import { Member, Settings } from '../types';

// En dev, laissez la valeur par défaut et utilisez le champ "proxy" du
// package.json (pointant vers `php -S localhost:8000`) pour éviter les soucis
// de CORS/cookies de session. En prod, servez le build React dans le même
// dossier que api.php pour que ce chemin relatif fonctionne tel quel.
const API_URL = process.env.REACT_APP_API_URL || 'api.php';

export class ApiError extends Error {}

async function request<T = any>(action: string, body: Record<string, any> = {}): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ApiError('Réponse invalide du serveur');
  }
  if (!data.ok) {
    throw new ApiError(data.error || 'Erreur serveur');
  }
  return data as T;
}

export interface LoadResponse {
  members: Member[];
  settings: Settings;
  auth?: { logged_in: boolean; display_name?: string; username?: string; role?: string };
}

export interface Album {
  id: number;
  title: string;
  description: string | null;
  eventDate: string | null;
  imageCount: number;
  createdAt: string | null;
}

export interface GalleryImage {
  id: number;
  albumId?: number;
  memberId?: string;
  photoFile: string;
  photo: string;
  caption?: string | null;
  histoire?: string | null;
  annee?: string | null;
  createdAt?: string | null;
}

async function upload<T>(action: string, fields: Record<string, string>, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('action', action);
  Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
  formData.append('photo', file);
  const response = await fetch(API_URL, { method: 'POST', credentials: 'same-origin', body: formData });
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Réponse invalide du serveur');
  }
  if (!data.ok) throw new ApiError(data.error || 'Erreur serveur');
  return data as T;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ message: string; display_name: string; username: string; role: string }>('login', { username, password }),

  updateProfile: (displayName: string) =>
    request<{ message: string; display_name: string }>('update_profile', { display_name: displayName }),

  getGallery: () => request<{ albums: Album[]; images: GalleryImage[]; familyPhotos: GalleryImage[] }>('get_gallery'),

  createAlbum: (album: { title: string; description: string; eventDate: string }) =>
    request<{ album: Album; message: string }>('create_album', album),

  updateAlbum: (id: number, album: { title: string; description: string; eventDate: string }) =>
    request<{ album: Album; message: string }>('update_album', { id: String(id), ...album }),

  uploadAlbumImage: (albumId: number, file: File, caption = '') =>
    upload<{ image: GalleryImage; message: string }>('upload_album_image', { albumId: String(albumId), caption }, file),

  deleteAlbumImage: (id: number) => request<{ message: string }>('delete_album_image', { id: String(id) }),

  deleteAlbum: (id: number) => request<{ message: string }>('delete_album', { id: String(id) }),

  uploadFamilyPhoto: (file: File) =>
    upload<{ file: string; url: string; message: string }>('upload_family_photo', {}, file),

  addFamilyPhoto: (photo: { memberId: string; photoFile: string; histoire: string; annee: string }) =>
    request<{ photo: GalleryImage; message: string }>('add_family_photo', photo),

  deleteFamilyPhoto: (id: number) => request<{ message: string }>('delete_family_photo_by_id', { id: String(id) }),

  load: () => request<LoadResponse>('load'),

  addMember: (member: Member) =>
    request<{ member: Member; message: string }>('add', { member }),

  updateMember: (member: Member) =>
    request<{ member: Member; message: string }>('update', { member }),

  deleteMember: (id: string) =>
    request<{ message: string; deleted_id: string }>('delete', { id }),

  saveSettings: (settings: Settings) =>
    request<{ message: string }>('save_settings', { settings }),

  importData: (members: Member[], settings: Settings | null) =>
    request<{ message: string; count: number }>('import', { members, settings }),

  clearAll: () => request<{ message: string }>('clear_all', { confirm: true }),
};
