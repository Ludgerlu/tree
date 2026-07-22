/* =====================================================
   ARBRE GÉNÉALOGIQUE — script.js
   Auth : bcrypt/sessions serveur + statut connecté
   Photos : upload fichier + validation + placeholder SVG
   ===================================================== */

/* ─── État global ─────────────────────────────────── */
let members   = [];
let settings  = { treeName: 'Ma Famille', theme: 0, orientation: 'top' };
let scale     = 1;
let editingId    = null;
let detailOpenId = null;
let isAuthenticated  = false;
let currentUser      = null;   // { display_name, username, role }
let pendingAddParentId = null;
let pendingEditId      = null;
let pendingDeleteId    = null;
let isSaving           = false;

/* ─── Photos de famille ───────────────────────────── */
let familyPhotos      = [];
let fpEditingId        = null; // id de la photo de famille en cours d'édition (form)
let fpViewId           = null; // id de la photo de famille affichée dans la vue détaillée

/* ─── Thèmes ──────────────────────────────────────── */
const THEMES = [
  { name:'Forêt',  gen0:'#2d5a3d',gen0l:'#e8f2ec',gen1:'#2d3d6b',gen1l:'#e8ecf7',gen2:'#7a3b2e',gen2l:'#f5ece9',gen3:'#2e5568',gen3l:'#e7f0f5',gen4:'#5a3068',gen4l:'#f2edf5',accent:'#2d5a3d',swatch:'#2d5a3d' },
  { name:'Océan',  gen0:'#1a4a6b',gen0l:'#e3eff8',gen1:'#1a6b5a',gen1l:'#e3f5f0',gen2:'#2e4a8a',gen2l:'#e5eaf8',gen3:'#6b2e5a',gen3l:'#f5e5f0',gen4:'#2e6b4a',gen4l:'#e5f5ec',accent:'#1a4a6b',swatch:'#1a6b8a' },
  { name:'Terres', gen0:'#6b3a1a',gen0l:'#f5ece3',gen1:'#5a4a1a',gen1l:'#f5f0e3',gen2:'#3a1a6b',gen2l:'#ece3f5',gen3:'#6b1a3a',gen3l:'#f5e3ec',gen4:'#1a6b3a',gen4l:'#e3f5ec',accent:'#6b3a1a',swatch:'#a05a30' },
  { name:'Nuit',   gen0:'#3d3d6b',gen0l:'#eeeef5',gen1:'#1a5a5a',gen1l:'#e3f5f5',gen2:'#5a1a5a',gen2l:'#f5e3f5',gen3:'#3d6b3d',gen3l:'#eef5ee',gen4:'#6b3d3d',gen4l:'#f5eeee',accent:'#3d3d6b',swatch:'#3d3d6b' },
  { name:'Grenat', gen0:'#7a1a2e',gen0l:'#f5e3e8',gen1:'#2e1a7a',gen1l:'#e8e3f5',gen2:'#1a7a4a',gen2l:'#e3f5ec',gen3:'#7a5a1a',gen3l:'#f5f0e3',gen4:'#1a5a7a',gen4l:'#e3f0f5',accent:'#7a1a2e',swatch:'#a0203d' },
];

/* ─── Dimensions nœuds ────────────────────────────── */
const NW=158, NH=80, NRX=12, GAP_X=36, GAP_Y=100, PHOTO_R=22;

/* ─── Init ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  showLoading(true);
  await loadData();
  buildThemePicker();
  applyTheme(settings.theme);
  updateAuthUI();
  renderTree();
  initPan();
  showLoading(false);
});

/* ─── API ─────────────────────────────────────────── */
const API = 'api.php';

async function apiCall(action, body = {}) {
  try {
    const res = await fetch(API, {
      method      : 'POST',
      credentials : 'same-origin',
      headers     : { 'Content-Type': 'application/json' },
      body        : JSON.stringify({ action, ...body }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  } catch (err) {
    showToast('Erreur : ' + err.message);
    throw err;
  }
}

/** Upload multipart/form-data (pour les photos) */
async function apiUpload(formData) {
  try {
    const res = await fetch(API, {
      method      : 'POST',
      credentials : 'same-origin',
      body        : formData,       // pas de Content-Type header → navigateur gère boundary
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Erreur upload');
    return data;
  } catch (err) {
    showToast('Erreur : ' + err.message);
    throw err;
  }
}

/* ─── Chargement ──────────────────────────────────── */
async function loadData() {
  try {
    const data = await apiCall('load');
    members      = data.members      || [];
    familyPhotos = data.familyPhotos || [];
    settings = { ...settings, ...(data.settings || {}) };
    settings.theme = parseInt(settings.theme) || 0;
    document.getElementById('tree-name-display').textContent = settings.treeName;

    // Restaurer la session si elle est toujours active côté serveur
    if (data.auth?.logged_in) {
      isAuthenticated = true;
      currentUser     = {
        display_name: data.auth.display_name,
        username    : data.auth.username,
        role        : data.auth.role,
      };
    }
  } catch(e) {
    members = [];
    familyPhotos = [];
  }
}

async function saveData() {
  try { await apiCall('save_settings', { settings }); } catch(e) {}
}

/* ─── Utilitaires ─────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function getGen(id, memo={}) {
  if (id in memo) return memo[id];
  const m = members.find(x=>x.id===id);
  if (!m || !m.parentId) { memo[id]=0; return 0; }
  memo[id] = getGen(m.parentId, memo) + 1;
  return memo[id];
}

function genColor(g, light=false) {
  const t=THEMES[settings.theme];
  const idx=Math.min(g,4);
  return light ? t[['gen0l','gen1l','gen2l','gen3l','gen4l'][idx]]
               : t[['gen0','gen1','gen2','gen3','gen4'][idx]];
}

function initials(m) {
  return ((m.firstname||'').trim()[0]||'') + ((m.lastname||'').trim()[0]||'');
}

function compareMembers(a,b) {
  const na=`${(a.lastname||'').trim()} ${(a.firstname||'').trim()}`.trim();
  const nb=`${(b.lastname||'').trim()} ${(b.firstname||'').trim()}`.trim();
  return na.localeCompare(nb,'fr',{sensitivity:'base'});
}

/* ═══════════════════════════════════════════════════
   RENDU ARBRE SVG
═══════════════════════════════════════════════════ */
function renderTree() {
  const svg   = document.getElementById('tree-svg');
  const empty = document.getElementById('empty-state');
  document.getElementById('member-count').textContent =
    members.length + ' membre' + (members.length>1?'s':'');

  if (members.length===0) {
    svg.innerHTML=''; svg.setAttribute('width',0); svg.setAttribute('height',0);
    empty.classList.add('show'); return;
  }
  empty.classList.remove('show');

  const positions = layoutTree();
  const allX = Object.values(positions).map(p=>p.x);
  const allY = Object.values(positions).map(p=>p.y);
  const W = Math.max(...allX)+NW+80;
  const H = Math.max(...allY)+NH+80;
  svg.setAttribute('width',W); svg.setAttribute('height',H);
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);

  let defs='<defs>'; let connectors=''; let nodes='';
  const genMemo={};
  members.forEach(m=>getGen(m.id,genMemo));

  // ─── Calcul des centres de couple ──────────────────
  const coupleCenters = {};
  members.forEach(m => {
    if (m.spouseId && positions[m.id] && positions[m.spouseId] && m.id < m.spouseId) {
      const p1 = positions[m.id];
      const p2 = positions[m.spouseId];
      const cx = (p1.x + NW + p2.x) / 2;
      const cy = p1.y + NH / 2;
      coupleCenters[m.id] = { x: cx, y: cy };
      coupleCenters[m.spouseId] = { x: cx, y: cy };
    }
  });

  // ─── Connecteurs ────────────────────────────────────
  members.forEach(m => {
    const pos = positions[m.id];
    if(!pos) return;

    // Connexion parent → enfant
    if(m.parentId && positions[m.parentId]) {
      const parent = members.find(p => p.id === m.parentId);
      const childPos = pos;
      let startX, startY;
      const hasSpouse = parent && parent.spouseId && positions[parent.spouseId];
      if (hasSpouse && coupleCenters[parent.id]) {
        const center = coupleCenters[parent.id];
        startX = center.x;
        startY = center.y;
      } else {
        const pp = positions[parent.id];
        startX = pp.x + NW/2;
        startY = pp.y + NH;
      }
      const endX = childPos.x + NW/2;
      const endY = childPos.y;
      const midY = (startY + endY) / 2;
      const col = genColor(genMemo[m.id] - 1);
      connectors += `<path d="M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}" fill="none" stroke="${col}" stroke-width="1.8" stroke-opacity=".5"/>`;
    }

    // Lien de couple + cœur
    if(m.spouseId && positions[m.spouseId] && m.id < m.spouseId) {
      const sp = positions[m.spouseId];
      connectors += `<line x1="${pos.x+NW}" y1="${pos.y+NH/2}" x2="${sp.x}" y2="${sp.y+NH/2}" stroke="#a89880" stroke-width="1.5" stroke-dasharray="5,4" stroke-opacity=".6"/>`;
      const cx = (pos.x + NW + sp.x) / 2;
      const cy = pos.y + NH/2;
      connectors += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="14" fill="#c0392b" opacity="0.8">❤️</text>`;
    }
  });

  // ─── Nœuds (inchangé) ──────────────────────────────
  members.forEach(m => {
    const pos = positions[m.id];
    if(!pos) return;
    const g = genMemo[m.id];
    const col = genColor(g), colL = genColor(g,true);
    const ini = initials(m);
    const photoClipId = `pc-${m.id}`;
    const hasPhoto = m.photo && m.photo.length>5;

    defs += `<clipPath id="${photoClipId}"><circle cx="${pos.x+PHOTO_R+12}" cy="${pos.y+NH/2}" r="${PHOTO_R}"/></clipPath>`;

    nodes += `<g class="node-group" data-id="${m.id}" onclick="openDetail('${m.id}')" oncontextmenu="openEditFromNode(event,'${m.id}')">`;
    nodes += `<rect class="node-rect" x="${pos.x}" y="${pos.y}" width="${NW}" height="${NH}" rx="${NRX}" fill="${colL}" stroke="${col}" stroke-width="1.8"/>`;

    const cx = pos.x + PHOTO_R + 12, cy = pos.y + NH/2;
    nodes += `<circle cx="${cx}" cy="${cy}" r="${PHOTO_R}" fill="${col}" opacity=".15"/>`;
    nodes += `<circle cx="${cx}" cy="${cy}" r="${PHOTO_R}" fill="none" stroke="${col}" stroke-width="1.5"/>`;

    if(hasPhoto) {
      nodes += `<image href="${m.photo}" x="${cx-PHOTO_R}" y="${cy-PHOTO_R}" width="${PHOTO_R*2}" height="${PHOTO_R*2}" clip-path="url(#${photoClipId})" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      nodes += svgPlaceholder(cx, cy, PHOTO_R, col, ini, m.gender);
    }

    const textX = pos.x + PHOTO_R*2 + 20;
    nodes += `<text x="${textX}" y="${pos.y+NH/2-9}" fill="${col}" font-family="'Cormorant Garamond',Georgia,serif" font-size="13.5" font-weight="600" style="pointer-events:none"><tspan>${truncate(m.firstname,12)}</tspan></text>`;
    nodes += `<text x="${textX}" y="${pos.y+NH/2+7}"  fill="${col}" font-family="'Cormorant Garamond',Georgia,serif" font-size="12" font-weight="400"   style="pointer-events:none"><tspan>${truncate(m.lastname,14)}</tspan></text>`;
    if(m.birth) {
      const yr = m.birth.slice(0,4)+(m.death?'–'+m.death.slice(0,4):'');
      nodes += `<text x="${textX}" y="${pos.y+NH/2+22}" fill="${col}" opacity=".65" font-family="'Inter',system-ui,sans-serif" font-size="10" style="pointer-events:none"><tspan>${yr}</tspan></text>`;
    }
    if(m.death) nodes += `<text x="${pos.x+NW-10}" y="${pos.y+16}" fill="${col}" opacity=".5" font-size="11" text-anchor="middle" style="pointer-events:none">†</text>`;
    nodes += `</g>`;
  });

  defs += '</defs>';
  svg.innerHTML = defs + connectors + nodes;
  applyTransform();
}

/** Placeholder SVG élégant avec initiales + icône genre */
function svgPlaceholder(cx, cy, r, col, ini, gender) {
  const genderSymbol = gender==='F' ? '♀' : gender==='M' ? '♂' : '⊙';
  const genderY = cy + r - 7;
  return `
    <g style="pointer-events:none">
      <circle cx="${cx}" cy="${cy}" r="${r-1}" fill="${col}" opacity=".08"/>
      <text x="${cx}" y="${cy+2}" text-anchor="middle" dominant-baseline="middle"
        fill="${col}" opacity=".85"
        font-family="'Cormorant Garamond',Georgia,serif"
        font-size="${r*0.9}" font-weight="600">${ini.toUpperCase()}</text>
      <text x="${cx+r-5}" y="${genderY}" text-anchor="middle"
        fill="${col}" opacity=".55" font-size="9">${genderSymbol}</text>
    </g>`;
}

function truncate(str,max) {
  if(!str) return '';
  return str.length>max ? str.slice(0,max-1)+'…' : str;
}

/* ─── Layout ──────────────────────────────────────── */
function layoutTree() {
  const positions = {};
  if (members.length === 0) return positions;

  // 1. Generation for each member (unchanged)
  const genMemo = {};
  members.forEach(m => getGen(m.id, genMemo));

  // 2. Build spouse pairs (couples)
  const coupleMap = {};       // memberId → entityId (primary)
  const couples = [];         // { primary, secondary, members: [id1,id2] }
  const processed = new Set();

  members.forEach(m => {
    if (m.spouseId && !processed.has(m.id) && !processed.has(m.spouseId)) {
      const spouse = members.find(x => x.id === m.spouseId);
      if (spouse) {
        const ids = [m.id, spouse.id].sort();
        const primary = ids[0];
        const secondary = ids[1];
        coupleMap[m.id] = primary;
        coupleMap[spouse.id] = primary;
        couples.push({ primary, secondary, members: ids });
        processed.add(m.id);
        processed.add(spouse.id);
      }
    }
  });

  // 3. Singles: their entity is themselves
  members.forEach(m => {
    if (!coupleMap[m.id]) {
      coupleMap[m.id] = m.id;
    }
  });

  // 4. Build entity objects
  const entities = [];
  const entityMap = {};

  // Couples
  couples.forEach(c => {
    const entity = {
      id: c.primary,
      members: c.members,
      isCouple: true,
      width: 2 * NW + GAP_X,   // side‑by‑side
      gen: genMemo[c.primary]
    };
    entities.push(entity);
    entityMap[c.primary] = entity;
  });

  // Singles
  members.forEach(m => {
    if (coupleMap[m.id] === m.id && !entityMap[m.id]) {
      const entity = {
        id: m.id,
        members: [m.id],
        isCouple: false,
        width: NW,
        gen: genMemo[m.id]
      };
      entities.push(entity);
      entityMap[m.id] = entity;
    }
  });

  // 5. Build children map for entities (entityId → list of child member ids)
  const childMap = {};
  entities.forEach(e => childMap[e.id] = []);

  members.forEach(m => {
    if (m.parentId) {
      const parentEntityId = coupleMap[m.parentId];
      if (parentEntityId && childMap[parentEntityId]) {
        childMap[parentEntityId].push(m.id);
      }
    }
  });

  // 6. Find root entities (those with no parent outside themselves)
  const roots = entities.filter(e => {
    for (const mid of e.members) {
      const m = members.find(x => x.id === mid);
      if (m && m.parentId) {
        const parentEntityId = coupleMap[m.parentId];
        if (parentEntityId && parentEntityId !== e.id) return false;
      }
    }
    return true;
  }).sort((a, b) => compareMembers(
    members.find(x => x.id === a.id),
    members.find(x => x.id === b.id)
  ));

  // Fallback if no roots (shouldn't happen with proper data)
  if (roots.length === 0) {
    const byGen = {};
    entities.forEach(e => {
      const g = e.gen || 0;
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(e);
    });
    Object.keys(byGen).map(Number).sort((a, b) => a - b).forEach(g => {
      byGen[g].sort((a, b) => compareMembers(
        members.find(x => x.id === a.id),
        members.find(x => x.id === b.id)
      )).forEach((e, i) => {
        const x = 40 + i * (e.width + GAP_X);
        const y = 40 + g * (NH + GAP_Y);
        assignMemberPositions(e, x, y, positions);
      });
    });
    return positions;
  }

  // 7. Layout – using the same extent algorithm but with entity widths
  const orientationTop = settings.orientation === 'top';
  const secondaryStep = orientationTop ? NH + GAP_Y : NW + GAP_Y;
  const extents = {};
  let nextPrimary = 40;

  function computeExtent(entity) {
    const childIds = childMap[entity.id] || [];
    // Deduplicate child entities (a couple may have multiple children)
    const childEntities = [];
    const seen = new Set();
    childIds.forEach(mid => {
      const eid = coupleMap[mid];
      if (eid && !seen.has(eid)) {
        seen.add(eid);
        childEntities.push(entityMap[eid]);
      }
    });
    childEntities.sort((a, b) => compareMembers(
      members.find(x => x.id === a.id),
      members.find(x => x.id === b.id)
    ));

    if (childEntities.length === 0) {
      const s = nextPrimary;
      const e = s + entity.width;
      nextPrimary = e + GAP_X;
      extents[entity.id] = { start: s, end: e };
      return extents[entity.id];
    }
    const ce = childEntities.map(computeExtent);
    const start = ce[0].start;
    const end = ce[ce.length - 1].end;
    extents[entity.id] = { start, end };
    return extents[entity.id];
  }

  function assignPositions(entity) {
    const e = extents[entity.id];
    const totalWidth = entity.width;
    const center = (e.start + e.end) / 2;
    const primaryX = center - totalWidth / 2;
    const y = 40 + (entity.gen || 0) * secondaryStep;

    // For now we only handle 'top' orientation – you can mirror for 'left' later
    const x = primaryX;
    const yPos = y;

    assignMemberPositions(entity, x, yPos, positions);

    // Recurse children
    const childIds = childMap[entity.id] || [];
    const childEntities = [];
    const seen = new Set();
    childIds.forEach(mid => {
      const eid = coupleMap[mid];
      if (eid && !seen.has(eid)) {
        seen.add(eid);
        childEntities.push(entityMap[eid]);
      }
    });
    childEntities.sort((a, b) => compareMembers(
      members.find(x => x.id === a.id),
      members.find(x => x.id === b.id)
    ));
    childEntities.forEach(assignPositions);
  }

  roots.forEach(computeExtent);
  roots.forEach(assignPositions);

  return positions;
}

// Helper to place members inside an entity
function assignMemberPositions(entity, x, y, positions) {
  if (entity.isCouple) {
    const [primary, secondary] = entity.members.sort(); // ensure order
    positions[primary] = { x: x, y: y };
    positions[secondary] = { x: x + NW + GAP_X, y: y };
  } else {
    positions[entity.members[0]] = { x: x, y: y };
  }
}

/* ─── Pan & Zoom ──────────────────────────────────── */
function initPan() {
  const inner = document.getElementById('canvas-inner');
  let dragging = false, startX, startY, startSL, startST;
  let lastTouchDist = 0;
  let touchStartScale = 1;
  let isTouching = false;
  let touchStartX, touchStartY, touchStartSL, touchStartST;

  // ─── Mouse drag (existing) ────────────────────────────
  inner.addEventListener('mousedown', e => {
    if (e.target.closest('.node-group')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startSL = inner.scrollLeft;
    startST = inner.scrollTop;
    inner.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    inner.scrollLeft = startSL - (e.clientX - startX);
    inner.scrollTop = startST - (e.clientY - startY);
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    inner.style.cursor = 'grab';
  });

  // ─── Mouse wheel zoom (existing) ──────────────────────
  inner.addEventListener('wheel', e => {
    e.preventDefault();
    scale = Math.max(0.3, Math.min(3, scale + (e.deltaY > 0 ? -0.08 : 0.08)));
    applyTransform();
  }, { passive: false });

  // ─── TOUCH SUPPORT ────────────────────────────────────
  inner.addEventListener('touchstart', e => {
    const touches = e.touches;
    if (touches.length === 1) {
      // Single touch: start pan
      isTouching = true;
      const t = touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartSL = inner.scrollLeft;
      touchStartST = inner.scrollTop;
    } else if (touches.length === 2) {
      // Two touches: start pinch
      const t1 = touches[0], t2 = touches[1];
      lastTouchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartScale = scale;
      isTouching = true;
    }
  }, { passive: true });

  inner.addEventListener('touchmove', e => {
    e.preventDefault(); // prevent page scroll
    const touches = e.touches;
    if (touches.length === 1 && isTouching) {
      // Pan with one finger
      const t = touches[0];
      inner.scrollLeft = touchStartSL - (t.clientX - touchStartX);
      inner.scrollTop = touchStartST - (t.clientY - touchStartY);
    } else if (touches.length === 2) {
      // Pinch with two fingers
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (lastTouchDist > 0) {
        const delta = dist / lastTouchDist;
        scale = Math.max(0.3, Math.min(3, touchStartScale * delta));
        applyTransform();
      }
      lastTouchDist = dist;
      touchStartScale = scale; // update to avoid jumps
    }
  }, { passive: false });

  inner.addEventListener('touchend', e => {
    isTouching = false;
    lastTouchDist = 0;
  }, { passive: true });
}
function applyTransform() { document.getElementById('tree-svg').style.transform=`scale(${scale})`; }
function zoomIn()  { scale=Math.min(3,scale+0.12); applyTransform(); }
function zoomOut() { scale=Math.max(0.3,scale-0.12); applyTransform(); }
function fitView() {
  const wrap=document.getElementById('canvas-wrap'), svg=document.getElementById('tree-svg');
  const sw=parseFloat(svg.getAttribute('width')||0), sh=parseFloat(svg.getAttribute('height')||0);
  if(!sw||!sh) return;
  scale=Math.min((wrap.clientWidth-80)/sw,(wrap.clientHeight-80)/sh,1);
  applyTransform();
  const inner=document.getElementById('canvas-inner');
  inner.scrollLeft=0; inner.scrollTop=0;
}

/* ═══════════════════════════════════════════════════
   AUTHENTIFICATION
═══════════════════════════════════════════════════ */
function openAuthModal() {
  document.getElementById('auth-username').value='';
  document.getElementById('auth-password').value='';
  document.getElementById('auth-error').textContent='';
  openModal('auth-modal');
}

async function submitAuth() {
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const btn      = document.querySelector('#auth-modal .btn-primary');

  if(!username || !password) {
    document.getElementById('auth-error').textContent='Veuillez remplir tous les champs.';
    return;
  }

  btn.disabled=true; btn.textContent='Connexion…';
  try {
    const res = await apiCall('login', { username, password });
    isAuthenticated = true;
    currentUser     = { display_name: res.display_name, username, role: res.role };
    closeModal('auth-modal');
    updateAuthUI();
    showToast(`Bienvenue, ${res.display_name || username} !`);

    // Exécuter l'action en attente
    if(pendingAddParentId!==null) { const p=pendingAddParentId; pendingAddParentId=null; openAddModal(p); return; }
    if(pendingEditId)             { const e=pendingEditId;      pendingEditId=null;      openEditModal(e); return; }
    if(pendingDeleteId)           { const d=pendingDeleteId;    pendingDeleteId=null;    deleteMember(d);  return; }
  } catch(err) {
    document.getElementById('auth-error').textContent = err.message || 'Identifiants incorrects.';
  } finally {
    btn.disabled=false; btn.textContent='Se connecter';
  }
}

async function logout() {
  try {
    await apiCall('logout');
  } catch(e) { /* silencieux */ }
  isAuthenticated = false;
  currentUser     = null;
  updateAuthUI();
  showToast('Déconnecté.');
}

function updateAuthUI() {
  const auth = isAuthenticated;
  // Boutons header
  document.getElementById('btn-header-add').style.display    = auth ? 'inline-flex' : 'none';
  document.getElementById('btn-empty-add').style.display     = auth ? 'inline-flex' : 'none';
  document.getElementById('btn-header-login').style.display  = auth ? 'none' : 'inline-flex';
  document.getElementById('btn-header-logout').style.display = auth ? 'inline-flex' : 'none';
  const detailEdit = document.getElementById('detail-edit-btn');
  if(detailEdit) detailEdit.style.display = auth ? 'inline-flex' : 'none';
  const galleryAdd = document.getElementById('btn-gallery-add');
  if(galleryAdd) galleryAdd.style.display = auth ? 'inline-flex' : 'none';

  // Statut utilisateur
  const statusEl = document.getElementById('user-status-bar');
  if(statusEl) {
    if(auth && currentUser) {
      const roleLabel = currentUser.role==='admin' ? 'Administrateur' : 'Éditeur';
      const roleColor = currentUser.role==='admin' ? 'var(--gen0)' : 'var(--gen3)';
      statusEl.innerHTML = `
        <span class="user-status-dot"></span>
        <span class="user-status-name">${escapeHtml(currentUser.display_name)}</span>
        <span class="user-status-role" style="background:${roleColor}20;color:${roleColor};border-color:${roleColor}40">${roleLabel}</span>
        <button class="user-status-pw" onclick="openChangePassword()" title="Changer le mot de passe">🔑</button>
      `;
      statusEl.classList.add('connected');
    } else {
      statusEl.innerHTML = `<span class="user-status-dot offline"></span><span style="color:var(--text-light);font-style:italic">Non connecté</span>`;
      statusEl.classList.remove('connected');
    }
  }
}

function escapeHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── Changement de mot de passe ──────────────────── */
function openChangePassword() {
  document.getElementById('cp-old').value='';
  document.getElementById('cp-new').value='';
  document.getElementById('cp-confirm').value='';
  document.getElementById('cp-error').textContent='';
  openModal('change-password-modal');
}

async function submitChangePassword() {
  const oldPw  = document.getElementById('cp-old').value;
  const newPw  = document.getElementById('cp-new').value;
  const confirm= document.getElementById('cp-confirm').value;
  const errEl  = document.getElementById('cp-error');
  const btn    = document.querySelector('#change-password-modal .btn-primary');

  errEl.textContent='';
  if(!oldPw||!newPw||!confirm) { errEl.textContent='Remplissez tous les champs.'; return; }
  if(newPw.length<8)            { errEl.textContent='Le nouveau mot de passe doit comporter au moins 8 caractères.'; return; }
  if(newPw!==confirm)           { errEl.textContent='Les mots de passe ne correspondent pas.'; return; }

  btn.disabled=true; btn.textContent='Modification…';
  try {
    await apiCall('change_password', { old_password: oldPw, new_password: newPw });
    closeModal('change-password-modal');
    showToast('Mot de passe modifié avec succès');
  } catch(err) {
    errEl.textContent = err.message || 'Erreur lors de la modification.';
  } finally {
    btn.disabled=false; btn.textContent='Modifier';
  }
}

/* ═══════════════════════════════════════════════════
   MODAL MEMBRE
═══════════════════════════════════════════════════ */
function openAddModal(parentId) {
  if(!isAuthenticated) { pendingAddParentId=parentId||null; openAuthModal(); return; }
  editingId=null;
  document.getElementById('modal-heading').textContent='Nouveau membre';
  document.getElementById('btn-delete').style.display='none';
  resetForm();
  populateSelects(null);
  if(parentId) document.getElementById('f-parent').value=parentId;
  openModal('member-modal');
}

function openEditModal(id) {
  if(!isAuthenticated) { pendingEditId=id; openAuthModal(); return; }
  const m=members.find(x=>x.id===id);
  if(!m) return;
  editingId=id;
  document.getElementById('modal-heading').textContent='Modifier le membre';
  document.getElementById('btn-delete').style.display='inline-flex';
  fillForm(m);
  populateSelects(id);
  document.getElementById('f-parent').value=m.parentId||'';
  document.getElementById('f-spouse').value=m.spouseId||'';
  openModal('member-modal');
}

function fillForm(m) {
  document.getElementById('f-firstname').value  = m.firstname  ||'';
  document.getElementById('f-lastname').value   = m.lastname   ||'';
  document.getElementById('f-birth').value      = m.birth      ||'';
  document.getElementById('f-birthplace').value = m.birthplace ||'';
  document.getElementById('f-death').value      = m.death      ||'';
  document.getElementById('f-deathplace').value = m.deathplace ||'';
  document.getElementById('f-notes').value      = m.notes      ||'';
  document.getElementById('f-photo').value      = m.photo      ||'';
  document.getElementById('f-photo-file').value = m.photoFile  ||'';
  const gv=m.gender||'M';
  document.querySelectorAll('input[name="gender"]').forEach(r=>r.checked=r.value===gv);
  if(typeof renderPhotoThumb==='function') renderPhotoThumb(m.photo||null);
}

function resetForm() {
  ['f-firstname','f-lastname','f-birth','f-birthplace','f-death','f-deathplace','f-notes','f-photo','f-photo-file']
    .forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('g-m').checked=true;
  if(typeof renderPhotoThumb==='function') renderPhotoThumb(null);
}

function populateSelects(excludeId) {
  const opts=members.filter(m=>m.id!==excludeId).sort(compareMembers)
    .map(m=>`<option value="${m.id}">${escapeHtml(m.firstname)} ${escapeHtml(m.lastname)}</option>`).join('');
  document.getElementById('f-parent').innerHTML=`<option value="">— Aucun (ancêtre racine) —</option>`+opts;
  document.getElementById('f-spouse').innerHTML=`<option value="">— Aucun —</option>`+opts;
}

async function saveMember() {
  if(isSaving) return;
  const btn=document.getElementById('btn-save-member');
  if(!btn) return;
  const fn=document.getElementById('f-firstname').value.trim();
  const ln=document.getElementById('f-lastname').value.trim();
  if(!fn||!ln) { showToast('Prénom et nom requis'); return; }
  if(!isAuthenticated) { showToast('Connexion requise'); openAuthModal(); return; }

  const gender   = document.querySelector('input[name="gender"]:checked')?.value||'M';
  const parentId = document.getElementById('f-parent').value||null;
  const spouseId = document.getElementById('f-spouse').value||null;
  isSaving=true; btn.disabled=true;
  const origText=btn.textContent; btn.textContent='Enregistrement…';

  // Photo : priorité au fichier uploadé, sinon URL
  let photo     = document.getElementById('f-photo').value.trim()||null;
  let photoFile = document.getElementById('f-photo-file').value.trim()||null;

  // Si un nouveau fichier a été sélectionné et pas encore uploadé → uploader maintenant
  const fileInput = document.getElementById('photo-file-input');
  if(fileInput.files.length>0) {
    try {
      const fd = new FormData();
      fd.append('action','upload_photo');
      fd.append('photo', fileInput.files[0]);
      if(photoFile) fd.append('replace_file', photoFile); // remplacer l'ancien
      const up = await apiUpload(fd);
      photo     = up.url;
      photoFile = up.file;
      fileInput.value='';
    } catch(e) {
      return; // toast déjà affiché
    }
  }

  const memberData = {
    id         : editingId || uid(),
    firstname  : fn, lastname: ln, gender,
    birth      : document.getElementById('f-birth').value      ||null,
    birthplace : document.getElementById('f-birthplace').value ||null,
    death      : document.getElementById('f-death').value      ||null,
    deathplace : document.getElementById('f-deathplace').value ||null,
    notes      : document.getElementById('f-notes').value      ||null,
    photo, photoFile, parentId, spouseId,
  };

  
  try {
    const action = editingId ? 'update' : 'add';
    const res    = await apiCall(action, { member: memberData });
    const fresh  = await apiCall('load');
    members = fresh.members||[];
    closeModal('member-modal');
    renderTree();
    showToast(res.message||(editingId?'Membre modifié':'Membre ajouté'));
  } catch(e) {
    console.error('saveMember:', e);
  } finally {
    btn.disabled=false; btn.textContent=origText; isSaving=false;
  }
}

function confirmDelete() {
  if(!editingId) return;
  if(!isAuthenticated) { pendingDeleteId=editingId; openAuthModal(); return; }
  const m=members.find(x=>x.id===editingId);
  if(!confirm(`Supprimer ${m?.firstname} ${m?.lastname} ?`)) return;
  deleteMember(editingId);
}

async function deleteMember(id) {
  if(!isAuthenticated) { pendingDeleteId=id; openAuthModal(); return; }
  try {
    await apiCall('delete',{id});
    members=members.map(m=>({...m,parentId:m.parentId===id?null:m.parentId,spouseId:m.spouseId===id?null:m.spouseId}))
                   .filter(m=>m.id!==id);
    closeModal('member-modal'); closeModal('detail-modal');
    renderTree(); showToast('Membre supprimé');
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════
   FICHE DÉTAIL
═══════════════════════════════════════════════════ */
function openDetail(id) {
  const m=members.find(x=>x.id===id);
  if(!m) return;
  detailOpenId=id;
  const genMemo={}; members.forEach(x=>getGen(x.id,genMemo));
  const g=genMemo[id]??0;

  document.getElementById('detail-name').textContent=`${m.firstname} ${m.lastname}`;

  const av=document.getElementById('detail-avatar');
  av.dataset.gen=Math.min(g,4);
  if(m.photo && m.photo.length>5) {
    av.innerHTML=`<img src="${m.photo}" alt="${escapeHtml(m.firstname)}"/>`;
  } else {
    const col=genColor(g);
    const genderSymbol=m.gender==='F'?'♀':m.gender==='M'?'♂':'⊙';
    av.innerHTML=`
      <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style="border-radius:50%">
        <circle cx="40" cy="40" r="40" fill="${col}" opacity=".12"/>
        <text x="40" y="43" text-anchor="middle" dominant-baseline="middle"
          fill="${col}" font-family="'Cormorant Garamond',Georgia,serif"
          font-size="28" font-weight="600" opacity=".85">${initials(m).toUpperCase()}</text>
        <text x="62" y="66" text-anchor="middle" fill="${col}" opacity=".5" font-size="16">${genderSymbol}</text>
      </svg>`;
  }

  const dates=[]; if(m.birth) dates.push('🎂 '+formatDate(m.birth)); if(m.death) dates.push('✝ '+formatDate(m.death));
  document.getElementById('detail-dates').textContent=dates.join('  ·  ');
  const places=[]; if(m.birthplace) places.push('📍 '+m.birthplace); if(m.deathplace) places.push('📍 '+m.deathplace);
  document.getElementById('detail-places').textContent=places.join('  ·  ');
  document.getElementById('detail-gen').textContent=`Génération ${g+1}`;
  document.getElementById('detail-notes').textContent=m.notes||'';
  buildDetailFamily(m,genMemo);
  openModal('detail-modal');
}

function buildDetailFamily(m,genMemo) {
  const container=document.getElementById('detail-family');
  let html='';
  const addSection=(title,items)=>{
    if(!items.length) return;
    html+=`<h3>${escapeHtml(title)}</h3><ul class="family-list">`;
    items.forEach(({rel,person})=>{
      const col=genColor(Math.min(genMemo[person.id]??0,4));
      const colL=genColor(Math.min(genMemo[person.id]??0,4),true);
      const avatarContent=person.photo&&person.photo.length>5
        ?`<img src="${person.photo}" alt="${escapeHtml(person.firstname)}"/>`
        :`<span style="font-family:'Cormorant Garamond',serif;font-size:12px;font-weight:600;color:${col};">${initials(person).toUpperCase()}</span>`;
      html+=`<li onclick="jumpDetail('${person.id}')">
        <div class="family-mini-avatar" style="border-color:${col};background:${colL};">${avatarContent}</div>
        <span>${escapeHtml(person.firstname)} ${escapeHtml(person.lastname)}</span>
        <span class="family-tag">${escapeHtml(rel)}</span>
      </li>`;
    });
    html+=`</ul>`;
  };
  const sp=m.spouseId?members.find(x=>x.id===m.spouseId):null;
  if(sp) addSection('Conjoint(e)',[{rel:'Conjoint(e)',person:sp}]);
  const par=m.parentId?members.find(x=>x.id===m.parentId):null;
  if(par) addSection('Parents',[{rel:par.gender==='F'?'Mère':'Père',person:par}]);
  const siblings=members.filter(x=>x.id!==m.id&&x.parentId&&x.parentId===m.parentId).map(x=>({rel:x.gender==='F'?'Sœur':'Frère',person:x}));
  addSection('Frères & sœurs',siblings);
  const children=members.filter(x=>x.parentId===m.id).map(x=>({rel:x.gender==='F'?'Fille':'Fils',person:x}));
  addSection('Enfants',children);
  container.innerHTML=html;
}

function jumpDetail(id) { closeModal('detail-modal'); setTimeout(()=>openDetail(id),180); }
function editFromDetail() { if(!detailOpenId) return; closeModal('detail-modal'); setTimeout(()=>openEditModal(detailOpenId),180); }
function openEditFromNode(e,id) { e.preventDefault(); openEditModal(id); }

/* ═══════════════════════════════════════════════════
   PHOTOS DE FAMILLE (galerie)
═══════════════════════════════════════════════════ */

/** Retourne les membres qui ont au moins un enfant → familles possibles */
function getFamilyHeads() {
  return members
    .filter(m => members.some(c => c.parentId === m.id))
    .sort(compareMembers);
}

/** Construit la liste des membres d'une famille (chef + conjoint + enfants) */
function getFamilyMembers(headId) {
  const head = members.find(x => x.id === headId);
  if (!head) return [];
  const list = [head];
  if (head.spouseId) {
    const sp = members.find(x => x.id === head.spouseId);
    if (sp) list.push(sp);
  }
  members.filter(c => c.parentId === headId).sort(compareMembers).forEach(c => list.push(c));
  return list;
}

function familyLabel(headId) {
  const head = members.find(x => x.id === headId);
  if (!head) return 'Famille inconnue';
  const sp = head.spouseId ? members.find(x => x.id === head.spouseId) : null;
  return sp
    ? `Famille de ${head.firstname} ${head.lastname} & ${sp.firstname} ${sp.lastname}`
    : `Famille de ${head.firstname} ${head.lastname}`;
}

function openGalleryModal() {
  renderGallery();
  openModal('gallery-modal');
}

function renderGallery() {
  const grid  = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  if (!familyPhotos.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = familyPhotos.map(fp => {
    const label = familyLabel(fp.memberId);
    const nbMembers = getFamilyMembers(fp.memberId).length;
    const storyPreview = (fp.histoire || '').slice(0, 70) + ((fp.histoire||'').length > 70 ? '…' : '');
    return `
      <div class="family-photo-card" onclick="openFamilyPhotoView(${fp.id})">
        <img class="family-photo-card-img" src="${fp.photo}" alt="${escapeHtml(label)}" onerror="this.style.display='none'"/>
        <div class="family-photo-card-body">
          <p class="family-photo-card-title">${escapeHtml(label)}</p>
          <p class="family-photo-card-meta">${fp.annee ? escapeHtml(fp.annee)+' · ' : ''}${nbMembers} personne${nbMembers>1?'s':''}</p>
          ${storyPreview ? `<p class="family-photo-card-meta" style="margin-top:4px;">${escapeHtml(storyPreview)}</p>` : ''}
        </div>
      </div>`;
  }).join('');
}

function openFamilyPhotoView(id) {
  const fp = familyPhotos.find(x => x.id === id);
  if (!fp) return;
  fpViewId = id;
  document.getElementById('fpv-title').textContent = familyLabel(fp.memberId);
  document.getElementById('fpv-annee').textContent  = fp.annee || '';
  document.getElementById('fpv-img').innerHTML = `<img src="${fp.photo}" alt=""/>`;
  document.getElementById('fpv-members').innerHTML = getFamilyMembers(fp.memberId)
    .map(m => `<span>${escapeHtml(m.firstname)} ${escapeHtml(m.lastname)}</span>`).join('');
  document.getElementById('fpv-story').textContent = fp.histoire || '';
  document.getElementById('fpv-edit-btn').style.display   = isAuthenticated ? 'inline-flex' : 'none';
  document.getElementById('fpv-delete-btn').style.display = isAuthenticated ? 'inline-flex' : 'none';
  openModal('family-photo-view-modal');
}

function editFamilyPhotoFromView() {
  if (!fpViewId) return;
  if (!isAuthenticated) { openAuthModal(); return; }
  const id = fpViewId;
  closeModal('family-photo-view-modal');
  setTimeout(() => openFamilyPhotoForm(id), 180);
}

async function deleteFamilyPhoto() {
  if (!fpViewId) return;
  if (!isAuthenticated) { openAuthModal(); return; }
  if (!confirm('Supprimer cette photo de famille ?')) return;
  try {
    await apiCall('delete_family_photo', { id: fpViewId });
    familyPhotos = familyPhotos.filter(x => x.id !== fpViewId);
    closeModal('family-photo-view-modal');
    renderGallery();
    showToast('Photo de famille supprimée');
  } catch(e) {}
}

/** Ouvre le formulaire. Sans paramètre → ajout. Avec un id → édition. */
function openFamilyPhotoForm(id = null) {
  if (!isAuthenticated) { openAuthModal(); return; }

  const heads = getFamilyHeads();
  if (!heads.length && id === null) {
    showToast("Aucun membre n'a encore d'enfants enregistrés dans l'arbre.");
    return;
  }

  fpEditingId = id;
  const existing = id ? familyPhotos.find(x => x.id === id) : null;

  document.getElementById('fpf-heading').textContent = existing ? 'Modifier la photo de famille' : 'Nouvelle photo de famille';
  const select = document.getElementById('fpf-member');
  select.innerHTML = heads.map(h => `<option value="${h.id}">${escapeHtml(familyLabel(h.id))}</option>`).join('');
  select.disabled = !!existing; // on ne change pas de famille en édition, on modifie juste la photo/histoire
  if (existing) select.value = existing.memberId;

  document.getElementById('fpf-id').value        = existing ? existing.id : '';
  document.getElementById('fpf-photo-file').value = existing ? existing.photoFile : '';
  document.getElementById('fpf-annee').value      = existing ? (existing.annee || '') : '';
  document.getElementById('fpf-histoire').value   = existing ? (existing.histoire || '') : '';
  document.getElementById('fpf-file-input').value = '';

  const preview = document.getElementById('fpf-photo-preview');
  preview.innerHTML = existing
    ? `<img src="${existing.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px"/>`
    : `<span class="text-muted small">Aucune photo</span>`;

  updateFamilyPreview();
  openModal('family-photo-form-modal');
}

function updateFamilyPreview() {
  const headId = document.getElementById('fpf-member').value;
  const box = document.getElementById('fpf-preview');
  if (!headId) { box.textContent = ''; return; }
  const list = getFamilyMembers(headId);
  box.textContent = 'Personnes sur cette photo : ' + list.map(m => `${m.firstname} ${m.lastname}`).join(', ');
}

async function handleFamilyPhotoFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const preview = document.getElementById('fpf-photo-preview');
  preview.innerHTML = `<span class="text-muted small">Chargement…</span>`;
  try {
    const fd = new FormData();
    fd.append('action', 'upload_family_photo');
    fd.append('photo', file);
    const oldFile = document.getElementById('fpf-photo-file').value;
    if (oldFile) fd.append('replace_file', oldFile);
    const up = await apiUpload(fd);
    document.getElementById('fpf-photo-file').value = up.file;
    preview.innerHTML = `<img src="${up.url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px"/>`;
  } catch(e) {
    preview.innerHTML = `<span class="text-muted small">Aucune photo</span>`;
  }
}

async function saveFamilyPhoto() {
  if (!isAuthenticated) { openAuthModal(); return; }

  const memberId  = document.getElementById('fpf-member').value;
  const photoFile = document.getElementById('fpf-photo-file').value.trim();
  const histoire  = document.getElementById('fpf-histoire').value.trim();
  const annee     = document.getElementById('fpf-annee').value.trim();
  const id        = document.getElementById('fpf-id').value || null;

  if (!memberId) { showToast('Veuillez sélectionner une famille'); return; }
  if (!photoFile) { showToast('Veuillez ajouter une photo'); return; }

  const btn = document.getElementById('btn-save-family-photo');
  btn.disabled = true;
  const orig = btn.textContent; btn.textContent = 'Enregistrement…';

  try {
    let res;
    if (id) {
      res = await apiCall('update_family_photo', { id, photoFile, histoire, annee });
      familyPhotos = familyPhotos.map(x => x.id === Number(id) ? res.photo : x);
    } else {
      res = await apiCall('add_family_photo', { memberId, photoFile, histoire, annee });
      familyPhotos.push(res.photo);
    }
    closeModal('family-photo-form-modal');
    renderGallery();
    showToast(res.message || 'Photo de famille enregistrée');
  } catch(e) {
    console.error('saveFamilyPhoto:', e);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

/* ─── Format date ─────────────────────────────────── */
function formatDate(iso) {
  if(!iso) return '';
  const [y,mo,d]=iso.split('-');
  const mois=['jan.','fév.','mar.','avr.','mai','jun.','jui.','aoû.','sep.','oct.','nov.','déc.'];
  if(mo&&d) return `${parseInt(d)} ${mois[parseInt(mo)-1]} ${y}`;
  if(mo) return `${mois[parseInt(mo)-1]} ${y}`;
  return y;
}

/* ─── Modals ──────────────────────────────────────── */
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(o=>{
  o.addEventListener('click',e=>{ if(e.target===o) o.classList.remove('open'); });
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(o=>o.classList.remove('open')); });

/* ─── Paramètres ──────────────────────────────────── */
function openSettings() {
  document.getElementById('s-treename').value=settings.treeName;
  document.querySelectorAll('input[name="orient"]').forEach(r=>r.checked=r.value===settings.orientation);
  openModal('settings-modal');
}
async function saveSettings() {
  settings.treeName   =document.getElementById('s-treename').value.trim()||'Ma Famille';
  settings.orientation=document.querySelector('input[name="orient"]:checked')?.value||'top';
  document.getElementById('tree-name-display').textContent=settings.treeName;
  await saveData();
  closeModal('settings-modal');
  renderTree();
  showToast('Paramètres enregistrés');
}

/* ─── Thème ───────────────────────────────────────── */
function buildThemePicker() {
  const picker=document.getElementById('theme-picker');
  picker.innerHTML=THEMES.map((t,i)=>`<div class="theme-swatch ${i===settings.theme?'active':''}" style="background:${t.swatch}" title="${t.name}" onclick="selectTheme(${i})"></div>`).join('');
}
function selectTheme(i) {
  settings.theme=i;
  document.querySelectorAll('.theme-swatch').forEach((s,idx)=>s.classList.toggle('active',idx===i));
  applyTheme(i); renderTree();
}
function applyTheme(i) {
  const t=THEMES[i],r=document.documentElement.style;
  ['gen0','gen1','gen2','gen3','gen4'].forEach((k,idx)=>{ r.setProperty(`--${k}`,t[k]); r.setProperty(`--${k}-light`,t[k+'l']); });
  r.setProperty('--accent',t.accent);
  r.setProperty('--accent-dark',shadeColor(t.accent,-20));
  r.setProperty('--accent-bg',t.gen0l);
  document.querySelector('.leg-gender.m')?.style.setProperty('background',t.gen1);
  document.querySelector('.leg-gender.f')?.style.setProperty('background',t.gen2);
}
function shadeColor(hex,p) {
  const n=parseInt(hex.replace('#',''),16);
  const r=Math.min(255,Math.max(0,(n>>16)+p)),g=Math.min(255,Math.max(0,((n>>8)&0xff)+p)),b=Math.min(255,Math.max(0,(n&0xff)+p));
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

/* ─── Export ──────────────────────────────────────── */
function openExport() { openModal('export-modal'); }
function exportSVG() { downloadBlob(new Blob([document.getElementById('tree-svg').outerHTML],{type:'image/svg+xml'}),`arbre-${settings.treeName}.svg`); closeModal('export-modal'); showToast('SVG exporté'); }
function exportJSON() { downloadBlob(new Blob([JSON.stringify({settings,members},null,2)],{type:'application/json'}),`arbre-${settings.treeName}.json`); closeModal('export-modal'); closeModal('settings-modal'); showToast('JSON exporté'); }
function printTree() { closeModal('export-modal'); setTimeout(()=>window.print(),200); }
function downloadBlob(blob,filename) { const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }

/* ─── Import ──────────────────────────────────────── */
function importData() { document.getElementById('file-input').click(); }
function handleImport(e) {
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    try {
      const data=JSON.parse(ev.target.result);
      const res=await apiCall('import',{members:data.members||[],settings:data.settings||null});
      const fresh=await apiCall('load');
      members=fresh.members||[]; settings={...settings,...(fresh.settings||{})}; settings.theme=parseInt(settings.theme)||0;
      document.getElementById('tree-name-display').textContent=settings.treeName;
      applyTheme(settings.theme); buildThemePicker(); renderTree(); closeModal('settings-modal');
      showToast(res.message||'Données importées');
    } catch { showToast('Fichier JSON invalide'); }
  };
  reader.readAsText(file); e.target.value='';
}

/* ─── Tout effacer ────────────────────────────────── */
async function clearAll() {
  if(!confirm('Effacer tous les membres ? Cette action est irréversible.')) return;
  try { await apiCall('clear_all',{confirm:true}); members=[]; renderTree(); closeModal('settings-modal'); showToast('Arbre effacé'); } catch(e) {}
}

/* ─── Loading / Toast ─────────────────────────────── */
function showLoading(visible) {
  let el=document.getElementById('loading-overlay');
  if(!el) { el=document.createElement('div'); el.id='loading-overlay'; el.innerHTML=`<div class="loading-spinner"></div><p>Chargement…</p>`; document.body.appendChild(el); }
  el.style.display=visible?'flex':'none';
}
function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2800);
}