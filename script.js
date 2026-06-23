/* =====================================================
   ARBRE GÉNÉALOGIQUE — script.js
   Compatible avec index.html + style.css optimisés
   ===================================================== */

/* ─── État global ─────────────────────────────────── */
let members   = [];       // tableau de membres
let settings  = {
  treeName  : 'Ma Famille',
  theme     : 0,
  orientation: 'top'      // 'top' | 'left'
};

let scale        = 1;
let panX         = 40;
let panY         = 40;
let editingId    = null;   // id du membre en cours d'édition
let detailOpenId = null;   // id du membre affiché dans la fiche détail
let isAuthenticated = false;
let pendingAddParentId = null;
let pendingEditId = null;
let pendingDeleteId = null;

/* ─── Thèmes de couleur ───────────────────────────── */
const THEMES = [
  {
    name : 'Forêt',
    gen0 : '#2d5a3d', gen0l: '#e8f2ec',
    gen1 : '#2d3d6b', gen1l: '#e8ecf7',
    gen2 : '#7a3b2e', gen2l: '#f5ece9',
    gen3 : '#2e5568', gen3l: '#e7f0f5',
    gen4 : '#5a3068', gen4l: '#f2edf5',
    accent: '#2d5a3d', swatch: '#2d5a3d'
  },
  {
    name : 'Océan',
    gen0 : '#1a4a6b', gen0l: '#e3eff8',
    gen1 : '#1a6b5a', gen1l: '#e3f5f0',
    gen2 : '#2e4a8a', gen2l: '#e5eaf8',
    gen3 : '#6b2e5a', gen3l: '#f5e5f0',
    gen4 : '#2e6b4a', gen4l: '#e5f5ec',
    accent: '#1a4a6b', swatch: '#1a6b8a'
  },
  {
    name : 'Terres',
    gen0 : '#6b3a1a', gen0l: '#f5ece3',
    gen1 : '#5a4a1a', gen1l: '#f5f0e3',
    gen2 : '#3a1a6b', gen2l: '#ece3f5',
    gen3 : '#6b1a3a', gen3l: '#f5e3ec',
    gen4 : '#1a6b3a', gen4l: '#e3f5ec',
    accent: '#6b3a1a', swatch: '#a05a30'
  },
  {
    name : 'Nuit',
    gen0 : '#3d3d6b', gen0l: '#eeeef5',
    gen1 : '#1a5a5a', gen1l: '#e3f5f5',
    gen2 : '#5a1a5a', gen2l: '#f5e3f5',
    gen3 : '#3d6b3d', gen3l: '#eef5ee',
    gen4 : '#6b3d3d', gen4l: '#f5eeee',
    accent: '#3d3d6b', swatch: '#3d3d6b'
  },
  {
    name : 'Grenat',
    gen0 : '#7a1a2e', gen0l: '#f5e3e8',
    gen1 : '#2e1a7a', gen1l: '#e8e3f5',
    gen2 : '#1a7a4a', gen2l: '#e3f5ec',
    gen3 : '#7a5a1a', gen3l: '#f5f0e3',
    gen4 : '#1a5a7a', gen4l: '#e3f0f5',
    accent: '#7a1a2e', swatch: '#a0203d'
  }
];

/* ─── Dimensions nœuds ────────────────────────────── */
const NW      = 158;   // node width
const NH      = 80;    // node height (avec photo)
const NRX     = 12;    // border-radius
const GAP_X   = 36;
const GAP_Y   = 100;
const PHOTO_R = 22;    // rayon de la photo dans le nœud

/* ─── Init ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);
  await loadData();          // attend la réponse de l'API SQLite
  buildThemePicker();
  applyTheme(settings.theme);
  updateAuthUI();
  renderTree();
  initPan();
  showLoading(false);
});

/* ─── Configuration API ───────────────────────────── */
const API = 'api.php';   // chemin vers api.php (même dossier)

/* ─── Verrou de sauvegarde ─────────────────────────── */
let isSaving = false; // verrou global

/** Appel générique vers api.php */
async function apiCall(action, body = {}) {
  try {
    const res = await fetch(API, {
      method : 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ action, ...body })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  } catch (err) {
    showToast('Erreur : ' + err.message);
    throw err;
  }
}

/* ─── Persistance (SQLite via api.php) ────────────── */

/** Chargement initial — remplace localStorage.getItem */
async function loadData() {
  try {
    const data = await apiCall('load');
    members  = data.members  || [];
    settings = { ...settings, ...(data.settings || {}) };
    settings.theme = parseInt(settings.theme) || 0;
    document.getElementById('tree-name-display').textContent = settings.treeName;
  } catch(e) {
    // Si l'API est inaccessible, on démarre avec un tableau vide
    members = [];
  }
}

/** Sauvegarde des paramètres uniquement (les membres sont sauvés un par un) */
async function saveData() {
  try {
    await apiCall('save_settings', { settings });
  } catch(e) { /* silencieux — toast déjà affiché par apiCall */ }
}

/* ─── Génération d'ID ─────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ─── Calcul de génération ────────────────────────── */
function getGen(id, memo = {}) {
  if (id in memo) return memo[id];
  const m = members.find(x => x.id === id);
  if (!m || !m.parentId) { memo[id] = 0; return 0; }
  memo[id] = getGen(m.parentId, memo) + 1;
  return memo[id];
}

/* ─── Couleur par génération ──────────────────────── */
function genColor(g, light = false) {
  const t = THEMES[settings.theme];
  const keys = ['gen0','gen1','gen2','gen3','gen4'];
  const lkeys = ['gen0l','gen1l','gen2l','gen3l','gen4l'];
  const idx = Math.min(g, 4);
  return light ? t[lkeys[idx]] : t[keys[idx]];
}

/* ─── Initiales ───────────────────────────────────── */
function initials(m) {
  const f = (m.firstname || '').trim();
  const l = (m.lastname  || '').trim();
  return (f[0] || '') + (l[0] || '');
}

function compareMembers(a, b) {
  const nameA = `${(a.lastname || '').trim()} ${(a.firstname || '').trim()}`.replace(/\s+/g, ' ').trim();
  const nameB = `${(b.lastname || '').trim()} ${(b.firstname || '').trim()}`.replace(/\s+/g, ' ').trim();
  return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
}

/* ─── RENDU ARBRE ─────────────────────────────────── */
function renderTree() {
  const svg = document.getElementById('tree-svg');
  const empty = document.getElementById('empty-state');
  document.getElementById('member-count').textContent =
    members.length + ' membre' + (members.length > 1 ? 's' : '');

  if (members.length === 0) {
    svg.innerHTML = '';
    svg.setAttribute('width', 0);
    svg.setAttribute('height', 0);
    empty.classList.add('show');
    return;
  }
  empty.classList.remove('show');

  // Calcul des positions
  const positions = layoutTree();

  // Taille canvas
  const allX = Object.values(positions).map(p => p.x);
  const allY = Object.values(positions).map(p => p.y);
  const W = Math.max(...allX) + NW + 80;
  const H = Math.max(...allY) + NH + 80;
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // Construire le SVG
  let defs = '<defs>';
  let connectors = '';
  let nodes = '';

  const genMemo = {};
  members.forEach(m => getGen(m.id, genMemo));

  // Connecteurs d'abord (derrière les nœuds)
  members.forEach(m => {
    const pos = positions[m.id];
    if (!pos) return;

    // Lien parent → enfant
    if (m.parentId && positions[m.parentId]) {
      const pp = positions[m.parentId];
      const x1 = pp.x + NW / 2;
      const y1 = pp.y + NH;
      const x2 = pos.x + NW / 2;
      const y2 = pos.y;
      const my = (y1 + y2) / 2;
      const col = genColor(genMemo[m.id] - 1);
      connectors += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"
        fill="none" stroke="${col}" stroke-width="1.8" stroke-opacity=".5"
        stroke-dasharray="" class="connector"/>`;
    }

    // Lien conjoint (horizontal pointillé)
    if (m.spouseId && positions[m.spouseId]) {
      const sp = positions[m.spouseId];
      // Relier seulement depuis le membre dont spouseId est défini (évite doublon)
      if (m.id < m.spouseId) {
        const x1 = pos.x + NW;
        const y1 = pos.y + NH / 2;
        const x2 = sp.x;
        const y2 = sp.y + NH / 2;
        connectors += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
          stroke="#a89880" stroke-width="1.5" stroke-dasharray="5,4" stroke-opacity=".6"/>`;
      }
    }
  });

  // Nœuds
  members.forEach(m => {
    const pos = positions[m.id];
    if (!pos) return;
    const g = genMemo[m.id];
    const col  = genColor(g);
    const colL = genColor(g, true);
    const ini  = initials(m);
    const photoId = `photo-clip-${m.id}`;
    const hasPhoto = m.photo && m.photo.length > 5;

    // ClipPath circulaire pour la photo
    defs += `<clipPath id="${photoId}">
      <circle cx="${pos.x + PHOTO_R + 12}" cy="${pos.y + NH/2}" r="${PHOTO_R}"/>
    </clipPath>`;

    // Groupe nœud (cliquable)
    nodes += `<g class="node-group" data-id="${m.id}"
      onclick="openDetail('${m.id}')"
      oncontextmenu="openEditFromNode(event,'${m.id}')">`;

    // Rectangle principal
    nodes += `<rect class="node-rect" x="${pos.x}" y="${pos.y}" width="${NW}" height="${NH}"
      rx="${NRX}" fill="${colL}" stroke="${col}" stroke-width="1.8"/>`;

    // Photo ou initiales (cercle)
    const cx = pos.x + PHOTO_R + 12;
    const cy = pos.y + NH / 2;

    nodes += `<circle cx="${cx}" cy="${cy}" r="${PHOTO_R}"
      fill="${col}" opacity=".15"/>`;
    nodes += `<circle cx="${cx}" cy="${cy}" r="${PHOTO_R}"
      fill="none" stroke="${col}" stroke-width="1.5"/>`;

    if (hasPhoto) {
      nodes += `<image href="${m.photo}" x="${cx - PHOTO_R}" y="${cy - PHOTO_R}"
        width="${PHOTO_R * 2}" height="${PHOTO_R * 2}"
        clip-path="url(#${photoId})" preserveAspectRatio="xMidYMid slice"
        class="node-photo"/>`;
    } else {
      nodes += `<text x="${cx}" y="${cy + 1}"
        text-anchor="middle" dominant-baseline="middle"
        fill="${col}" font-family="'Cormorant Garamond', Georgia, serif"
        font-size="13" font-weight="600" class="node-initials">${ini.toUpperCase()}</text>`;
    }

    // Texte : prénom + nom
    const textX = pos.x + PHOTO_R * 2 + 20;
    const textW = NW - PHOTO_R * 2 - 24;
    nodes += `<text x="${textX}" y="${pos.y + NH/2 - 9}"
      fill="${col}" font-family="'Cormorant Garamond', Georgia, serif"
      font-size="13.5" font-weight="600"
      clip-path="" style="pointer-events:none">
      <tspan>${truncate(m.firstname, 12)}</tspan>
    </text>`;
    nodes += `<text x="${textX}" y="${pos.y + NH/2 + 7}"
      fill="${col}" font-family="'Cormorant Garamond', Georgia, serif"
      font-size="12" font-weight="400"
      style="pointer-events:none">
      <tspan>${truncate(m.lastname, 14)}</tspan>
    </text>`;

    // Année de naissance (si présente)
    if (m.birth) {
      const yr = m.birth.slice(0, 4);
      const deathYr = m.death ? '–' + m.death.slice(0, 4) : '';
      nodes += `<text x="${textX}" y="${pos.y + NH/2 + 22}"
        fill="${col}" opacity=".65" font-family="'Inter', system-ui, sans-serif"
        font-size="10" style="pointer-events:none">
        <tspan>${yr}${deathYr}</tspan>
      </text>`;
    }

    // Indicateur de décès (petite croix)
    if (m.death) {
      nodes += `<text x="${pos.x + NW - 10}" y="${pos.y + 16}"
        fill="${col}" opacity=".5" font-size="11" text-anchor="middle"
        style="pointer-events:none">†</text>`;
    }

    nodes += `</g>`;
  });

  defs += '</defs>';
  svg.innerHTML = defs + connectors + nodes;

  applyTransform();
}

/* ─── Troncature ──────────────────────────────────── */
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

/* ─── Layout algorithme (hiérarchique) ───────────────
   Positionnement top→down ou left→right selon settings.orientation
   Algorithme : BFS par niveau, centrage des sous-arbres
*/
function layoutTree() {
  const positions = {};
  if (members.length === 0) return positions;

  const genMemo = {};
  members.forEach(m => getGen(m.id, genMemo));

  const childMap = {};
  members.forEach(m => {
    if (m.parentId) {
      childMap[m.parentId] = childMap[m.parentId] || [];
      childMap[m.parentId].push(m);
    }
  });

  const roots = members.filter(m => !m.parentId).slice().sort(compareMembers);
  if (roots.length === 0) {
    // Fallback to simple generation layout when no root is found
    const byGen = {};
    members.forEach(m => {
      const g = genMemo[m.id];
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(m);
    });
    const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);
    gens.forEach(g => {
      const row = byGen[g].slice().sort(compareMembers);
      row.forEach((m, i) => {
        positions[m.id] = {
          x: 40 + i * (NW + GAP_X),
          y: 40 + g * (NH + GAP_Y)
        };
      });
    });
    return positions;
  }

  const orientationTop = settings.orientation === 'top';
  const primarySize = orientationTop ? NW : NH;
  const primaryGap  = GAP_X;
  const secondaryStep = orientationTop ? NH + GAP_Y : NW + GAP_Y;

  const extents = {};
  let nextPrimary = 40;

  function computeExtent(node) {
    const children = (childMap[node.id] || []).slice().sort(compareMembers);
    if (children.length === 0) {
      const start = nextPrimary;
      const end   = start + primarySize;
      nextPrimary = end + primaryGap;
      extents[node.id] = { start, end };
      return extents[node.id];
    }

    const childExtents = children.map(computeExtent);
    const start = childExtents[0].start;
    const end   = childExtents[childExtents.length - 1].end;
    extents[node.id] = { start, end };
    return extents[node.id];
  }

  function assignPositions(node) {
    const g = genMemo[node.id] || 0;
    const e = extents[node.id];
    const primary = e.start + (e.end - e.start - primarySize) / 2;

    if (orientationTop) {
      positions[node.id] = { x: primary, y: 40 + g * secondaryStep };
    } else {
      positions[node.id] = { x: 40 + g * secondaryStep, y: primary };
    }

    const children = (childMap[node.id] || []).slice().sort(compareMembers);
    children.forEach(assignPositions);
  }

  roots.forEach(computeExtent);
  roots.forEach(assignPositions);

  return positions;
}

/* ─── PAN & ZOOM ──────────────────────────────────── */
function initPan() {
  const inner = document.getElementById('canvas-inner');
  let dragging = false, startX, startY, startSL, startST;

  inner.addEventListener('mousedown', e => {
    if (e.target.closest('.node-group')) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startSL = inner.scrollLeft; startST = inner.scrollTop;
    inner.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    inner.scrollLeft = startSL - (e.clientX - startX);
    inner.scrollTop  = startST - (e.clientY - startY);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    inner.style.cursor = 'grab';
  });

  // Zoom molette
  inner.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    scale = Math.max(0.3, Math.min(3, scale + delta));
    applyTransform();
  }, { passive: false });
}

function applyTransform() {
  document.getElementById('tree-svg').style.transform =
    `scale(${scale})`;
}

function zoomIn()  { scale = Math.min(3,   scale + 0.12); applyTransform(); }
function zoomOut() { scale = Math.max(0.3, scale - 0.12); applyTransform(); }

function fitView() {
  const wrap  = document.getElementById('canvas-wrap');
  const svg   = document.getElementById('tree-svg');
  const sw    = parseFloat(svg.getAttribute('width')  || 0);
  const sh    = parseFloat(svg.getAttribute('height') || 0);
  if (!sw || !sh) return;
  const sx = (wrap.clientWidth  - 80) / sw;
  const sy = (wrap.clientHeight - 80) / sh;
  scale = Math.min(sx, sy, 1);
  applyTransform();
  const inner = document.getElementById('canvas-inner');
  inner.scrollLeft = 0;
  inner.scrollTop  = 0;
}

/* ─── MODAL MEMBRE ────────────────────────────────── */
function openAddModal(parentId) {
  if (!isAuthenticated) {
    pendingAddParentId = parentId || null;
    openAuthModal();
    return;
  }
  editingId = null;
  document.getElementById('modal-heading').textContent = 'Nouveau membre';
  document.getElementById('btn-delete').style.display = 'none';
  resetForm();
  populateSelects(null);
  if (parentId) document.getElementById('f-parent').value = parentId;
  openModal('member-modal');
}

function openEditModal(id) {
  if (!isAuthenticated) {
    pendingEditId = id;
    openAuthModal();
    return;
  }
  const m = members.find(x => x.id === id);
  if (!m) return;
  editingId = id;
  document.getElementById('modal-heading').textContent = 'Modifier le membre';
  document.getElementById('btn-delete').style.display = 'inline-flex';
  fillForm(m);
  populateSelects(id);
  document.getElementById('f-parent').value = m.parentId || '';
  document.getElementById('f-spouse').value = m.spouseId || '';
  openModal('member-modal');
}

function openAuthModal() {
  document.getElementById('auth-username').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-error').textContent = '';
  openModal('auth-modal');
}

async function submitAuth() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;

  try {
    const res = await apiCall('login', { username, password });
    isAuthenticated = true;
    closeModal('auth-modal');
    updateAuthUI();

    if (pendingAddParentId !== null) {
      const parentId = pendingAddParentId;
      pendingAddParentId = null;
      openAddModal(parentId);
      return;
    }
    if (pendingEditId) {
      const editId = pendingEditId;
      pendingEditId = null;
      openEditModal(editId);
      return;
    }
    if (pendingDeleteId) {
      const deleteId = pendingDeleteId;
      pendingDeleteId = null;
      deleteMember(deleteId);
      return;
    }

    showToast(res.message || 'Connecté.');
  } catch (err) {
    document.getElementById('auth-error').textContent = err.message || 'Nom d’utilisateur ou mot de passe incorrect.';
  }
}

function logout() {
  isAuthenticated = false;
  updateAuthUI();
  showToast('Déconnecté.');
}

function updateAuthUI() {
  const showAuth = isAuthenticated;
  document.getElementById('btn-header-add').style.display = showAuth ? 'inline-flex' : 'none';
  document.getElementById('btn-empty-add').style.display = showAuth ? 'inline-flex' : 'none';
  document.getElementById('btn-header-login').style.display = showAuth ? 'none' : 'inline-flex';
  document.getElementById('btn-header-logout').style.display = showAuth ? 'inline-flex' : 'none';
  const detailEdit = document.getElementById('detail-edit-btn');
  if (detailEdit) detailEdit.style.display = showAuth ? 'inline-flex' : 'none';
}

function fillForm(m) {
  document.getElementById('f-firstname').value   = m.firstname   || '';
  document.getElementById('f-lastname').value    = m.lastname    || '';
  document.getElementById('f-birth').value       = m.birth       || '';
  document.getElementById('f-birthplace').value  = m.birthplace  || '';
  document.getElementById('f-death').value       = m.death       || '';
  document.getElementById('f-deathplace').value  = m.deathplace  || '';
  document.getElementById('f-notes').value       = m.notes       || '';
  document.getElementById('f-photo').value       = m.photo       || '';
  const gv = m.gender || 'M';
  document.querySelectorAll('input[name="gender"]').forEach(r => {
    r.checked = r.value === gv;
  });
  // Photo preview
  if (typeof renderPhotoThumb === 'function') renderPhotoThumb(m.photo || null);
}

function resetForm() {
  ['f-firstname','f-lastname','f-birth','f-birthplace',
   'f-death','f-deathplace','f-notes','f-photo'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('g-m').checked = true;
  if (typeof renderPhotoThumb === 'function') renderPhotoThumb(null);
}

function populateSelects(excludeId) {
  const ps = document.getElementById('f-parent');
  const ss = document.getElementById('f-spouse');
  const opts = members.filter(m => m.id !== excludeId)
    .slice()
    .sort(compareMembers)
    .map(m => `<option value="${m.id}">${m.firstname} ${m.lastname}</option>`)
    .join('');
  ps.innerHTML = `<option value="">— Aucun (ancêtre racine) —</option>` + opts;
  ss.innerHTML = `<option value="">— Aucun —</option>` + opts;
}

async function saveMember() {
  if (isSaving) return;
  const btn = document.getElementById('btn-save-member');
  if (!btn) return;
  const fn = document.getElementById('f-firstname').value.trim();
  const ln = document.getElementById('f-lastname').value.trim();
  if (!fn || !ln) { showToast('Prénom et nom requis'); return; }

  const gender   = document.querySelector('input[name="gender"]:checked')?.value || 'M';
  const parentId = document.getElementById('f-parent').value || null;
  const spouseId = document.getElementById('f-spouse').value || null;
  const photo    = document.getElementById('f-photo').value.trim() || null;

  if (!isAuthenticated) {
    showToast('Connexion requise pour enregistrer.');
    openAuthModal();
    return;
  }

  const memberData = {
    id         : editingId || uid(),
    firstname  : fn,
    lastname   : ln,
    gender,
    birth      : document.getElementById('f-birth').value      || null,
    birthplace : document.getElementById('f-birthplace').value || null,
    death      : document.getElementById('f-death').value      || null,
    deathplace : document.getElementById('f-deathplace').value || null,
    notes      : document.getElementById('f-notes').value      || null,
    photo,
    parentId,
    spouseId
  };

  // Désactiver le bouton et modifier son texte
  isSaving = true;
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Enregistrement…';

  try {
    const action = editingId ? 'update' : 'add';
    const res    = await apiCall(action, { member: memberData });

    // Recharger tous les membres depuis la BDD (pour avoir les liens conjoints sync)
    const fresh = await apiCall('load');
    members = fresh.members || [];

    closeModal('member-modal');
    renderTree();
    showToast(res.message || (editingId ? 'Membre modifié' : 'Membre ajouté'));
  } catch(e) { /* toast déjà affiché */ 
    // Le toast est déjà affiché par apiCall, mais on peut ajouter un message supplémentaire
    console.error('saveMember error:', e);
  } finally {
    // Réactiver le bouton dans tous les cas
    btn.disabled = false;
    btn.textContent = originalText;
    isSaving = false;
  }
}

function confirmDelete() {
  if (!editingId) return;
  if (!isAuthenticated) {
    pendingDeleteId = editingId;
    openAuthModal();
    return;
  }
  const m = members.find(x => x.id === editingId);
  if (!confirm(`Supprimer ${m?.firstname} ${m?.lastname} ?`)) return;
  deleteMember(editingId);
}

async function deleteMember(id) {
  if (!isAuthenticated) {
    pendingDeleteId = id;
    openAuthModal();
    return;
  }

  try {
    await apiCall('delete', { id });

    // Mettre à jour le tableau local
    members = members.map(m => ({
      ...m,
      parentId : m.parentId === id ? null : m.parentId,
      spouseId : m.spouseId === id ? null : m.spouseId
    }));
    members = members.filter(m => m.id !== id);

    closeModal('member-modal');
    closeModal('detail-modal');
    renderTree();
    showToast('Membre supprimé');
  } catch(e) { /* toast déjà affiché */ }
}

/* ─── FICHE DÉTAIL ────────────────────────────────── */
function openDetail(id) {
  const m = members.find(x => x.id === id);
  if (!m) return;
  detailOpenId = id;

  const genMemo = {};
  members.forEach(x => getGen(x.id, genMemo));
  const g = genMemo[id] ?? 0;

  // Nom
  document.getElementById('detail-name').textContent =
    `${m.firstname} ${m.lastname}`;

  // Avatar avec couleur de génération
  const av = document.getElementById('detail-avatar');
  av.dataset.gen = Math.min(g, 4);
  if (m.photo && m.photo.length > 5) {
    av.innerHTML = `<img src="${m.photo}" alt="${m.firstname}"/>`;
  } else {
    av.innerHTML = initials(m).toUpperCase();
  }

  // Dates
  const dates = [];
  if (m.birth) dates.push('🎂 ' + formatDate(m.birth));
  if (m.death) dates.push('✝ '  + formatDate(m.death));
  document.getElementById('detail-dates').textContent = dates.join('  ·  ');

  // Lieux
  const places = [];
  if (m.birthplace) places.push('📍 ' + m.birthplace);
  if (m.deathplace) places.push('📍 ' + m.deathplace);
  document.getElementById('detail-places').textContent = places.join('  ·  ');

  // Badge génération
  document.getElementById('detail-gen').textContent = `Génération ${g + 1}`;

  // Notes
  document.getElementById('detail-notes').textContent = m.notes || '';

  // Famille
  buildDetailFamily(m, genMemo);

  openModal('detail-modal');
}

function buildDetailFamily(m, genMemo) {
  const container = document.getElementById('detail-family');
  let html = '';

  const addSection = (title, items) => {
    if (!items.length) return;
    html += `<h3>${title}</h3><ul class="family-list">`;
    items.forEach(({ rel, person }) => {
      const ini = initials(person).toUpperCase();
      const g   = Math.min(genMemo[person.id] ?? 0, 4);
      const col = genColor(g);
      const colL= genColor(g, true);
      const avatarContent = person.photo && person.photo.length > 5
        ? `<img src="${person.photo}" alt="${person.firstname}"/>`
        : `<span style="font-family:'Cormorant Garamond',serif;font-size:12px;font-weight:600;color:${col};">${ini}</span>`;
      html += `<li onclick="jumpDetail('${person.id}')">
        <div class="family-mini-avatar" style="border-color:${col};background:${colL};">${avatarContent}</div>
        <span>${person.firstname} ${person.lastname}</span>
        <span class="family-tag">${rel}</span>
      </li>`;
    });
    html += `</ul>`;
  };

  // Conjoint
  const spouseItems = [];
  if (m.spouseId) {
    const sp = members.find(x => x.id === m.spouseId);
    if (sp) spouseItems.push({ rel: 'Conjoint(e)', person: sp });
  }
  addSection('Conjoint(e)', spouseItems);

  // Parents
  const parentItems = [];
  if (m.parentId) {
    const p = members.find(x => x.id === m.parentId);
    if (p) parentItems.push({ rel: p.gender === 'F' ? 'Mère' : 'Père', person: p });
  }
  addSection('Parents', parentItems);

  // Frères & sœurs
  const siblingItems = members
    .filter(x => x.id !== m.id && x.parentId && x.parentId === m.parentId)
    .map(x => ({ rel: x.gender === 'F' ? 'Sœur' : 'Frère', person: x }));
  addSection('Frères & sœurs', siblingItems);

  // Enfants
  const childItems = members
    .filter(x => x.parentId === m.id)
    .map(x => ({ rel: x.gender === 'F' ? 'Fille' : 'Fils', person: x }));
  addSection('Enfants', childItems);

  container.innerHTML = html;
}

function jumpDetail(id) {
  closeModal('detail-modal');
  setTimeout(() => openDetail(id), 180);
}

function editFromDetail() {
  if (!detailOpenId) return;
  closeModal('detail-modal');
  setTimeout(() => openEditModal(detailOpenId), 180);
}

function openEditFromNode(e, id) {
  e.preventDefault();
  openEditModal(id);
}

/* ─── FORMAT DATE ─────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-');
  const mois = ['jan.','fév.','mar.','avr.','mai','jun.',
                 'jui.','aoû.','sep.','oct.','nov.','déc.'];
  if (mo && d) return `${parseInt(d)} ${mois[parseInt(mo)-1]} ${y}`;
  if (mo)      return `${mois[parseInt(mo)-1]} ${y}`;
  return y;
}

/* ─── MODAL UTILITAIRES ───────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Fermer en cliquant sur l'overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Fermer avec Échap
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
  }
});

/* ─── PARAMÈTRES ──────────────────────────────────── */
function openSettings() {
  document.getElementById('s-treename').value = settings.treeName;
  document.querySelectorAll('input[name="orient"]').forEach(r => {
    r.checked = r.value === settings.orientation;
  });
  openModal('settings-modal');
}

async function saveSettings() {
  settings.treeName    = document.getElementById('s-treename').value.trim() || 'Ma Famille';
  settings.orientation = document.querySelector('input[name="orient"]:checked')?.value || 'top';
  document.getElementById('tree-name-display').textContent = settings.treeName;
  await saveData();          // envoie à l'API SQLite
  closeModal('settings-modal');
  renderTree();
  showToast('Paramètres enregistrés');
}

/* ─── THÈME ───────────────────────────────────────── */
function buildThemePicker() {
  const picker = document.getElementById('theme-picker');
  picker.innerHTML = THEMES.map((t, i) =>
    `<div class="theme-swatch ${i === settings.theme ? 'active' : ''}"
      style="background:${t.swatch}" title="${t.name}"
      onclick="selectTheme(${i})"></div>`
  ).join('');
}

function selectTheme(i) {
  settings.theme = i;
  document.querySelectorAll('.theme-swatch').forEach((s, idx) => {
    s.classList.toggle('active', idx === i);
  });
  applyTheme(i);
  renderTree();
}

function applyTheme(i) {
  const t = THEMES[i];
  const r = document.documentElement.style;
  r.setProperty('--gen0',      t.gen0);
  r.setProperty('--gen0-light',t.gen0l);
  r.setProperty('--gen1',      t.gen1);
  r.setProperty('--gen1-light',t.gen1l);
  r.setProperty('--gen2',      t.gen2);
  r.setProperty('--gen2-light',t.gen2l);
  r.setProperty('--gen3',      t.gen3);
  r.setProperty('--gen3-light',t.gen3l);
  r.setProperty('--gen4',      t.gen4);
  r.setProperty('--gen4-light',t.gen4l);
  r.setProperty('--accent',    t.accent);
  r.setProperty('--accent-dark', shadeColor(t.accent, -20));
  r.setProperty('--accent-bg',   t.gen0l);
  // Légende swatches
  document.querySelector('.leg-gender.m')?.style.setProperty('background', t.gen1);
  document.querySelector('.leg-gender.f')?.style.setProperty('background', t.gen2);
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

/* ─── EXPORT ──────────────────────────────────────── */
function openExport() { openModal('export-modal'); }

function exportSVG() {
  const svg  = document.getElementById('tree-svg');
  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
  downloadBlob(blob, `arbre-${settings.treeName}.svg`);
  closeModal('export-modal');
  showToast('SVG exporté');
}

function exportJSON() {
  const payload = { settings, members };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `arbre-${settings.treeName}.json`);
  closeModal('export-modal');
  closeModal('settings-modal');
  showToast('JSON exporté');
}

function printTree() {
  closeModal('export-modal');
  setTimeout(() => window.print(), 200);
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─── IMPORT ──────────────────────────────────────── */
function importData() {
  document.getElementById('file-input').click();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      // Envoyer les données à l'API pour import en BDD
      const res = await apiCall('import', {
        members  : data.members  || [],
        settings : data.settings || null
      });
      // Recharger depuis la BDD
      const fresh = await apiCall('load');
      members  = fresh.members || [];
      settings = { ...settings, ...(fresh.settings || {}) };
      settings.theme = parseInt(settings.theme) || 0;
      document.getElementById('tree-name-display').textContent = settings.treeName;
      applyTheme(settings.theme);
      buildThemePicker();
      renderTree();
      closeModal('settings-modal');
      showToast(res.message || 'Données importées');
    } catch {
      showToast('Fichier JSON invalide');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ─── TOUT EFFACER ────────────────────────────────── */
async function clearAll() {
  if (!confirm('Effacer tous les membres ? Cette action est irréversible.')) return;
  try {
    await apiCall('clear_all', { confirm: true });
    members = [];
    renderTree();
    closeModal('settings-modal');
    showToast('Arbre effacé');
  } catch(e) { /* toast déjà affiché */ }
}

/* ─── INDICATEUR DE CHARGEMENT ────────────────────── */
function showLoading(visible) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.innerHTML = `<div class="loading-spinner"></div><p>Chargement…</p>`;
    document.body.appendChild(el);
  }
  el.style.display = visible ? 'flex' : 'none';
}

/* ─── TOAST ───────────────────────────────────────── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}