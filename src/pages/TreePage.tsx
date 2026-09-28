/**
 * pages/TreePage.tsx
 * Page principale : assemble l'en-tête, le canvas SVG et toutes les modales.
 * Reprend l'orchestration de l'ancien script.js (openAddModal, openEditModal,
 * flux "action en attente" après connexion, export SVG/JSON/impression).
 */
import React, { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { usePanZoom } from '../hooks/usePanZoom';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';
import ZoomControls from '../components/ZoomControls';
import LegendBar from '../components/LegendBar';
import TreeCanvas from '../components/TreeCanvas';
import EmptyState from '../components/EmptyState';
import MemberModal from '../components/MemberModal';
import AuthModal from '../components/AuthModal';
import DetailModal from '../components/DetailModal';
import SettingsModal from '../components/SettingsModal';
import ExportModal from '../components/ExportModal';
import Toast from '../components/Toast';
import LoadingOverlay from '../components/LoadingOverlay';
import { Member } from '../types';
import { computeAllGens } from '../services/treeLayout';
import { THEMES } from '../services/themes';

type PendingAction =
  | { type: 'add'; parentId: string | null }
  | { type: 'edit'; id: string }
  | { type: 'delete'; id: string }
  | null;

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TreePage() {
  const {
    members, settings, isAuthenticated, loading, toast,
    login, logout, addMember, updateMember, deleteMember,
    saveSettings, importData, clearAll,
  } = useApp();

  const { containerRef, svgRef, scale, zoomIn, zoomOut, resetZoom, fitView, focusMember } = usePanZoom();

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const [authOpen, setAuthOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [highlightedMemberId, setHighlightedMemberId] = useState<string | null>(null);

  const openAdd = useCallback((parentId: string | null) => {
    setEditingMember(null);
    setDefaultParentId(parentId);
    setMemberModalOpen(true);
  }, []);

  const openEdit = useCallback(
    (id: string) => {
      const m = members.find((x) => x.id === id);
      if (!m) return;
      setEditingMember(m);
      setMemberModalOpen(true);
    },
    [members]
  );

  const doDelete = useCallback(
    (id: string) => {
      deleteMember(id)
        .then(() => {
          setMemberModalOpen(false);
          setDetailId(null);
        })
        .catch(() => { /* toast déjà affiché */ });
    },
    [deleteMember]
  );

  // Les actions protégées ouvrent la modale de connexion et sont rejouées après succès
  const requestAdd = useCallback(
    (parentId: string | null = null) => {
      if (!isAuthenticated) {
        setPendingAction({ type: 'add', parentId });
        setAuthOpen(true);
        return;
      }
      openAdd(parentId);
    },
    [isAuthenticated, openAdd]
  );

  const requestEdit = useCallback(
    (id: string) => {
      if (!isAuthenticated) {
        setPendingAction({ type: 'edit', id });
        setAuthOpen(true);
        return;
      }
      openEdit(id);
    },
    [isAuthenticated, openEdit]
  );

  const requestDelete = useCallback(
    (id: string) => {
      if (!isAuthenticated) {
        setPendingAction({ type: 'delete', id });
        setAuthOpen(true);
        return;
      }
      doDelete(id);
    },
    [isAuthenticated, doDelete]
  );

  const handleAuthSubmit = useCallback(
    async (username: string, password: string) => {
      await login(username, password); // en cas d'échec, l'erreur remonte à AuthModal
      setAuthOpen(false);
      const action = pendingAction;
      setPendingAction(null);
      if (!action) return;
      if (action.type === 'add') openAdd(action.parentId);
      else if (action.type === 'edit') openEdit(action.id);
      else if (action.type === 'delete') doDelete(action.id);
    },
    [login, pendingAction, openAdd, openEdit, doDelete]
  );

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setPendingAction(null);
  }, []);

  const handleSaveMember = useCallback(
    async (member: Member) => {
      if (editingMember) await updateMember(member);
      else await addMember(member);
    },
    [editingMember, addMember, updateMember]
  );

  const handleJump = useCallback((id: string) => {
    setDetailId(null);
    window.setTimeout(() => setDetailId(id), 180);
  }, []);

  const handleFocusMember = useCallback((id: string) => {
    if (!focusMember(id)) return false;
    setHighlightedMemberId(id);
    window.setTimeout(() => {
      setHighlightedMemberId((currentId) => currentId === id ? null : currentId);
    }, 5000);
    return true;
  }, [focusMember]);

  const handleEditFromDetail = useCallback(
    (id: string) => {
      setDetailId(null);
      window.setTimeout(() => requestEdit(id), 180);
    },
    [requestEdit]
  );

  const exportSVG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
    downloadBlob(blob, `arbre-${settings.treeName}.svg`);
  }, [svgRef, settings.treeName]);

  const exportJSON = useCallback(() => {
    const payload = { settings, members };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `arbre-${settings.treeName}.json`);
  }, [settings, members]);

  const printTree = useCallback(() => {
    window.setTimeout(() => window.print(), 200);
  }, []);

  const genMemo = computeAllGens(members);
  const theme = THEMES[settings.theme] ?? THEMES[0];
  const detailMember = detailId ? members.find((m) => m.id === detailId) ?? null : null;

  return (
    <>
      <Header
        treeName={settings.treeName}
        isAuthenticated={isAuthenticated}
        onAdd={() => requestAdd(null)}
        onLogin={() => setAuthOpen(true)}
        onLogout={logout}
        onExport={() => setExportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
      <LegendBar memberCount={members.length} />

      <div id="canvas-wrap">
        <div id="canvas-inner" ref={containerRef}>
          <TreeCanvas
            members={members}
            settings={settings}
            scale={scale}
            svgRef={svgRef}
            highlightedMemberId={highlightedMemberId}
            onOpenDetail={setDetailId}
            onEditFromNode={requestEdit}
          />
        </div>
        <EmptyState show={members.length === 0} isAuthenticated={isAuthenticated} onAdd={() => requestAdd(null)} />

        <ZoomControls
          scale={scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetZoom}
          onFit={fitView}
          members={members}
          onFocusMember={handleFocusMember}
        />
      </div>

      <BottomNav
        onHome={fitView}
        onAdd={() => requestAdd(null)}
        onExport={() => setExportOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />

      <MemberModal
        open={memberModalOpen}
        editingMember={editingMember}
        defaultParentId={defaultParentId}
        members={members}
        onClose={() => setMemberModalOpen(false)}
        onSave={handleSaveMember}
        onDelete={requestDelete}
      />

      <AuthModal open={authOpen} onClose={closeAuth} onSubmit={handleAuthSubmit} />

      <DetailModal
        open={!!detailMember}
        member={detailMember}
        members={members}
        genMemo={genMemo}
        theme={theme}
        isAuthenticated={isAuthenticated}
        onClose={() => setDetailId(null)}
        onJump={handleJump}
        onEdit={handleEditFromDetail}
      />

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
        onImportFile={importData}
        onExportJSON={exportJSON}
        onClearAll={clearAll}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExportSVG={exportSVG}
        onExportJSON={exportJSON}
        onPrint={printTree}
      />

      <Toast message={toast.message} visible={toast.visible} />
      <LoadingOverlay visible={loading} />
    </>
  );
}
