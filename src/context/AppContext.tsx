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
import { buildChildMap, computeAllGens, getAncestorIds } from '../services/treeLayout';

const COLLAPSED_KEY = 'arbre.collapsed';
const DEFAULT_VISIBLE_GENERATIONS = 2;
const PREVIOUS_DEFAULT_VISIBLE_GENERATIONS = 3;

function getDefaultCollapsedIds(members: Member[], visibleGenerations: number): Set<string> {
  const generations = computeAllGens(members);
  const children = buildChildMap(members);
  return new Set(
    members
      .filter((member) => generations[member.id] === visibleGenerations - 1 && (children[member.id] || []).length > 0)
      .map((member) => member.id)
  );
}

function haveSameIds(first: Set<string>, second: Set<string>): boolean {
  return first.size === second.size && Array.from(first).every((id) => second.has(id));
}

function loadCollapsed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set<string>();
  }
}

const DEFAULT_SETTINGS: Settings = { treeName: 'Wandji', theme: 0, orientation: 'top', visibleGenerations: DEFAULT_VISIBLE_GENERATIONS };

interface ToastState {
  message: string;
  visible: boolean;
}

interface AccountInfo {
  displayName: string;
  username: string;
  role: string;
}

interface AppContextValue {
  members: Member[];
  settings: Settings;
  isAuthenticated: boolean;
  account: AccountInfo | null;
  loading: boolean;
  toast: ToastState;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string) => void;
  expandTo: (id: string, includeSelf?: boolean) => void;
  showToast: (msg: string) => void;
  login: (username: string, password: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
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
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(loadCollapsed);
  const hasSavedCollapseState = useRef(window.localStorage.getItem(COLLAPSED_KEY) !== null);

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
    merged.visibleGenerations = Math.max(1, Math.min(5, Math.round(Number(merged.visibleGenerations) || DEFAULT_VISIBLE_GENERATIONS)));
    return merged;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api.load();
      const loadedMembers = data.members || [];
      const loadedSettings = mergeSettings(data.settings, DEFAULT_SETTINGS);
      setMembers(loadedMembers);
      const defaultCollapsedIds = getDefaultCollapsedIds(loadedMembers, loadedSettings.visibleGenerations);
      if (!hasSavedCollapseState.current) {
        setCollapsedIds(defaultCollapsedIds);
        hasSavedCollapseState.current = true;
      } else if (haveSameIds(
        loadCollapsed(),
        getDefaultCollapsedIds(loadedMembers, PREVIOUS_DEFAULT_VISIBLE_GENERATIONS)
      )) {
        setCollapsedIds(defaultCollapsedIds);
      }
      setSettings(loadedSettings);
      if (data.auth?.logged_in) {
        setIsAuthenticated(true);
        setAccount({
          displayName: data.auth.display_name || data.auth.username || '',
          username: data.auth.username || '',
          role: data.auth.role || 'editor',
        });
      } else {
        setIsAuthenticated(false);
        setAccount(null);
      }
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
      const res = await api.login(username, password);
      setIsAuthenticated(true);
      setAccount({ displayName: res.display_name, username: res.username, role: res.role });
      showToast(res.message || 'Connecté.');
    },
    [showToast]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setAccount(null);
    showToast('Déconnecté.');
  }, [showToast]);

  const updateProfile = useCallback(async (displayName: string) => {
    try {
      const res = await api.updateProfile(displayName);
      setAccount((current) => current ? { ...current, displayName: res.display_name } : current);
      showToast(res.message || 'Profil modifié.');
    } catch (e) {
      handleError(e);
      throw e;
    }
  }, [handleError, showToast]);

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
      const normalized = mergeSettings(s, DEFAULT_SETTINGS);
      setSettings(normalized);
      if (settings.visibleGenerations !== normalized.visibleGenerations) {
        setCollapsedIds(getDefaultCollapsedIds(members, normalized.visibleGenerations));
      }
      try {
        await api.saveSettings(normalized);
      } catch (e) {
        handleError(e);
      }
    },
    [handleError, members, mergeSettings, settings.visibleGenerations]
  );

  const importData = useCallback(
    async (newMembers: Member[], newSettings: Settings | null) => {
      try {
        const res = await api.importData(newMembers, newSettings);
        const fresh = await api.load();
        const importedMembers = fresh.members || [];
        const importedSettings = mergeSettings(fresh.settings, settings);
        setMembers(importedMembers);
        setSettings(importedSettings);
        setCollapsedIds(getDefaultCollapsedIds(importedMembers, importedSettings.visibleGenerations));
        showToast(res.message || 'Données importées');
      } catch (e) {
        handleError(e);
        throw e;
      }
    },
    [handleError, mergeSettings, settings, showToast]
  );

  const clearAll = useCallback(async () => {
    try {
      await api.clearAll();
      setMembers([]);
      setCollapsedIds(new Set());
      showToast('Arbre effacé');
    } catch (e) {
      handleError(e);
      throw e;
    }
  }, [handleError, showToast]);

  useEffect(() => {
    if (loading) return;
    try {
      window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(collapsedIds)));
    } catch {
      /* stockage indisponible : le repli reste valable pour la session */
    }
  }, [collapsedIds, loading]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Déplie les ancêtres de `id` (et `id` lui-même si includeSelf) pour le rendre visible. */
  const expandTo = useCallback(
    (id: string, includeSelf = false) => {
      const ids = getAncestorIds(members, id);
      if (includeSelf) ids.push(id);
      setCollapsedIds((prev) => {
        if (!ids.some((x) => prev.has(x))) return prev;
        const next = new Set(prev);
        ids.forEach((x) => next.delete(x));
        return next;
      });
    },
    [members]
  );

  const value: AppContextValue = {
    members,
    settings,
    isAuthenticated,
    account,
    loading,
    toast: { message: toastMsg, visible: toastVisible },
    collapsedIds,
    toggleCollapse,
    expandTo,
    showToast,
    login,
    updateProfile,
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
