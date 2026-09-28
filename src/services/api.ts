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
}

export const api = {
  login: (username: string, password: string) =>
    request<{ message: string }>('login', { username, password }),

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
