/**
 * context/AppContext.tsx
 * État global de l'application : membres, paramètres, authentification, toast.
 * Reprend la logique de loadData()/saveData()/apiCall() de l'ancien script.js,
 * mais via des appels typés à services/api.ts.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Member, Settings } from '../types';
import { api } from '../services/api';
import { applyThemeVars } from '../services/themes';

const DEFAULT_SETTINGS: Settings = { treeName: 'Ma Famille', theme: 0, orientation: 'top' };

interface ToastState {
  message: string;
  visible: boolean;
}

interface AppContextValue {
  members: Member[];
  settings: Settings;
  isAuthenticated: boolean;
  loading: boolean;
  toast: ToastState;
  showToast: (msg: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  addMember: (m: Member) => Promise<void>;
  updateMember: (m: Member) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  importData: (members: Member[], settings: Settings | null) => Promise<void>;
  clearAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<number>();

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2800);
  }, []);

  const handleError = useCallback(
    (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Erreur serveur';
      showToast('Erreur : ' + msg);
    },
    [showToast]
  );

  const mergeSettings = useCallback((incoming: Partial<Settings> | undefined, base: Settings): Settings => {
    const merged = { ...base, ...(incoming || {}) } as Settings;
    merged.theme = Number(merged.theme) || 0;
    return merged;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.load();
      setMembers(data.members || []);
      setSettings((s) => mergeSettings(data.settings, s));
    } catch (e) {
      // Si l'API est inaccessible, on démarre avec un tableau vide (comme l'ancien comportement)
      setMembers([]);
      handleError(e);
    }
  }, [handleError, mergeSettings]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refresh();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyThemeVars(settings.theme);
  }, [settings.theme]);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password); // laisse l'erreur remonter à l'appelant (modale d'auth)
      setIsAuthenticated(true);
      showToast(res.message || 'Connecté.');
    },
    [showToast]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    showToast('Déconnecté.');
  }, [showToast]);

  const addMember = useCallback(
    async (m: Member) => {
      try {
        const res = await api.addMember(m);
        const fresh = await api.load();
        setMembers(fresh.members || []);
        showToast(res.message || 'Membre ajouté');
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [handleError, showToast]
  );

  const updateMember = useCallback(
    async (m: Member) => {
      try {
        const res = await api.updateMember(m);
        const fresh = await api.load();
        setMembers(fresh.members || []);
        showToast(res.message || 'Membre modifié');
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [handleError, showToast]
  );

  const deleteMember = useCallback(
    async (id: string) => {
      try {
        await api.deleteMember(id);
        setMembers((prev) =>
          prev
            .map((m) => ({
              ...m,
              parentId: m.parentId === id ? null : m.parentId,
              spouseId: m.spouseId === id ? null : m.spouseId,
            }))
            .filter((m) => m.id !== id)
        );
        showToast('Membre supprimé');
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [handleError, showToast]
  );

  const saveSettings = useCallback(
    async (s: Settings) => {
      setSettings(s);
      try {
        await api.saveSettings(s);
      } catch (e) {
        handleError(e);
      }
    },
    [handleError]
  );

  const importData = useCallback(
    async (newMembers: Member[], newSettings: Settings | null) => {
      try {
        const res = await api.importData(newMembers, newSettings);
        const fresh = await api.load();
        setMembers(fresh.members || []);
        setSettings((s) => mergeSettings(fresh.settings, s));
        showToast(res.message || 'Données importées');
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [handleError, mergeSettings, showToast]
  );

  const clearAll = useCallback(async () => {
    try {
      await api.clearAll();
      setMembers([]);
      showToast('Arbre effacé');
    } catch (e) {
      handleError(e);
      throw e;
    }
  }, [handleError, showToast]);

  const value: AppContextValue = {
    members,
    settings,
    isAuthenticated,
    loading,
    toast: { message: toastMsg, visible: toastVisible },
    showToast,
    login,
    logout,
    addMember,
    updateMember,
    deleteMember,
    saveSettings,
    importData,
    clearAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé à l\'intérieur de <AppProvider>');
  return ctx;
}
