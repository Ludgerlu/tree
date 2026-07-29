/* =====================================================
   ARBRE GÉNÉALOGIQUE — script.js
   Auth : bcrypt/sessions serveur + statut connecté
   Photos : upload fichier + validation + placeholder SVG
   ===================================================== */

/* ─── État global ─────────────────────────────────── */
let members   = [];
let settings  = { treeName: 'Ma Famille', theme: 0, orientation: 'top' };
let collapsed = new Set(); // ids des entités (parent/couple) dont les descendants sont repliés
let lastPositions = {};    // dernières positions rendues (pour animer depuis/vers le bon endroit)
let lastButtonPos = {};    // dernières positions des boutons collapse/expand
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
const NW = 180;          // largeur de la carte (plus grande)
const NH = 220;          // hauteur (plus grande)
const NRX = 12;          // coins arrondis
const GAP_X = 50;        // espace horizontal entre cartes
const GAP_Y = 130;       // espace vertical entre générations
const PHOTO_SIZE = 80;   // taille de la photo (carrée)
const PARCHMENT = '#f8f0da';

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
    collapsed = new Set(settings.collapsed || []);
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

/** Clé d'entité pour un membre : id du couple (le plus petit des deux ids triés) ou son propre id s'il est seul.
 *  C'est la même clé utilisée comme identifiant d'entité dans layoutTree(). */
function entityKeyOf(id) {
  const m = members.find(x => x.id === id);
  if (m && m.spouseId && members.find(x => x.id === m.spouseId)) {
    return [m.id, m.spouseId].sort()[0];
  }
  return id;
}

/** Map { entityKey: true } pour toute entité ayant au moins un enfant (indépendant de l'état replié/déplié). */
function computeHasChildrenMap() {
  const map = {};
  members.forEach(m => {
    if (m.parentId) map[entityKeyOf(m.parentId)] = true;
  });
  return map;
}

/** Map { entityKey: nombre d'enfants directs } (indépendant de l'état replié/déplié). */
function computeChildCountMap() {
  const map = {};
  members.forEach(m => {
    if (m.parentId) {
      const key = entityKeyOf(m.parentId);
      map[key] = (map[key] || 0) + 1;
    }
  });
  return map;
}

/** Ensemble des ids de membres masqués car un de leurs ancêtres est replié. */
function computeHiddenIds() {
  const hidden = new Set();
  function ancestorCollapsed(m) {
    let cur = m;
    const seen = new Set();
    while (cur && cur.parentId && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (collapsed.has(entityKeyOf(cur.parentId))) return true;
      cur = members.find(x => x.id === cur.parentId);
    }
    return false;
  }
  members.forEach(m => { if (ancestorCollapsed(m)) hidden.add(m.id); });
  return hidden;
}

/** Tous les ids de membres descendant (fils, petits-fils, ...) de l'entité `key`, récursivement. */
function descendantIdsOf(key) {
  const km = members.find(x => x.id === key);
  const parentIds = km && km.spouseId ? [km.id, km.spouseId] : [key];
  const ids = new Set();
  function recurse(pids) {
    members.forEach(m => {
      if (m.parentId && pids.includes(m.parentId) && !ids.has(m.id)) {
        ids.add(m.id);
        recurse([m.id, m.spouseId].filter(Boolean));
      }
    });
  }
  recurse(parentIds);
  return ids;
}

const COLLAPSE_ANIM_MS = 220;
const COLLAPSE_STAGGER_MS = 28;

/** Point central (écran, avant transform de zoom) d'un membre d'après un cache de positions donné. */
function centerOf(id, posMap) {
  const p = posMap[id];
  if (!p) return null;
  return { x: p.x + NW / 2, y: p.y + NH / 2 };
}

/** Replie ou déplie la branche descendant de l'entité identifiée par `key`, avec une animation
 *  qui fait jaillir/engouffrer les cartes dans le bouton, en cascade. */
function toggleCollapse(key) {
  const svg = document.getElementById('tree-svg');
  const willCollapse = !collapsed.has(key);
  const btn = lastButtonPos[key];

  function targetsFor(ids, posMap, btnRef) {
    // Ordonne les cartes par distance au bouton pour une cascade cohérente
    return Array.from(ids)
      .map(id => ({ id, c: centerOf(id, posMap) }))
      .filter(t => t.c)
      .sort((a, b) => {
        const da = Math.hypot(a.c.x - btnRef.bx, a.c.y - btnRef.by);
        const db = Math.hypot(b.c.x - btnRef.bx, b.c.y - btnRef.by);
        return da - db;
      });
  }

  if (willCollapse) {
    const ids = descendantIdsOf(key);
    if (svg && btn && ids.size) {
      const targets = targetsFor(ids, lastPositions, btn);
      targets.forEach((t, i) => {
        const g = svg.querySelector(`.node-group[data-id="${t.id}"]`);
        const link = svg.querySelector(`path.link-path[data-child="${t.id}"]`);
        const delay = i * COLLAPSE_STAGGER_MS;
        const dx = btn.bx - t.c.x, dy = btn.by - t.c.y;
        if (g) {
          g.style.transitionDelay = `${delay}ms`;
          g.style.transform = `translate(${dx}px,${dy}px) scale(.15)`;
          g.style.opacity = '0';
        }
        if (link) {
          link.style.transition = `opacity ${COLLAPSE_ANIM_MS}ms ease`;
          link.style.transitionDelay = `${delay}ms`;
          link.style.opacity = '0';
        }
      });
    }
    setTimeout(() => {
      collapsed.add(key);
      settings.collapsed = Array.from(collapsed);
      saveData();
      renderTree();
    }, (svg && btn && ids.size) ? COLLAPSE_ANIM_MS + ids.size * COLLAPSE_STAGGER_MS : 0);
  } else {
    collapsed.delete(key);
    settings.collapsed = Array.from(collapsed);
    saveData();
    const ids = descendantIdsOf(key);
    renderTree();
    // Double rAF : on force l'état "au bouton" à être peint avant d'animer vers la position finale
    requestAnimationFrame(() => {
      const svg2 = document.getElementById('tree-svg');
      const btn2 = lastButtonPos[key];
      if (!svg2 || !btn2) return;
      const targets = targetsFor(ids, lastPositions, btn2);
      targets.forEach((t, i) => {
        const g = svg2.querySelector(`.node-group[data-id="${t.id}"]`);
        const link = svg2.querySelector(`path.link-path[data-child="${t.id}"]`);
        const dx = btn2.bx - t.c.x, dy = btn2.by - t.c.y;
        if (g) {
          g.style.transitionDelay = '0ms';
          g.style.transform = `translate(${dx}px,${dy}px) scale(.15)`;
          g.style.opacity = '0';
        }
        if (link) { link.style.transition = 'none'; link.style.opacity = '0'; }
      });
      requestAnimationFrame(() => {
        targets.forEach((t, i) => {
          const g = svg2.querySelector(`.node-group[data-id="${t.id}"]`);
          const link = svg2.querySelector(`path.link-path[data-child="${t.id}"]`);
          const delay = i * COLLAPSE_STAGGER_MS;
          if (g) {
            g.style.transitionDelay = `${delay}ms`;
            g.style.transitionTimingFunction = 'cubic-bezier(.34,1.56,.64,1)';
            g.style.transform = '';
            g.style.opacity = '';
          }
          if (link) {
            link.style.transition = `opacity ${COLLAPSE_ANIM_MS}ms ease`;
            link.style.transitionDelay = `${delay}ms`;
            link.style.opacity = '';
          }
        });
      });
    });
  }
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

  let defs='<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1c1610" flood-opacity="0.18"/></filter>'; let connectors=''; let nodes='';
  const genMemo={};
  members.forEach(m=>getGen(m.id,genMemo));

  // ─── Calcul des centres de couple ──────────────────
  const coupleCenters = {};
  members.forEach(m => {
    if (m.spouseId && positions[m.id] && positions[m.spouseId] && m.id < m.spouseId) {
      const p1 = positions[m.id];
      const p2 = positions[m.spouseId];
      let cx, cy;
      if (settings.orientation === 'top') {
        cx = (p1.x + NW + p2.x) / 2;
        cy = p1.y + NH / 2;
      } else {
        cx = p1.x + NW / 2;
        cy = (p1.y + NH + p2.y) / 2;
      }
      coupleCenters[m.id] = { x: cx, y: cy };
      coupleCenters[m.spouseId] = { x: cx, y: cy };
    }
  });

  // ─── Positions des boutons collapse/expand (calculées avant les connecteurs,
  //     pour que les branches partent bien DU bouton et non du parent) ──────
  const orientationTop = settings.orientation === 'top';
  const hasChildrenMap = computeHasChildrenMap();
  const childCountMap = computeChildCountMap();
  const buttonPos = {};
  Object.keys(hasChildrenMap).forEach(key => {
    const pos = positions[key];
    if (!pos) return;
    let ax, ay;
    if (orientationTop) {
      ax = coupleCenters[key] ? coupleCenters[key].x : pos.x + NW / 2;
      ay = pos.y + NH;
    } else {
      ax = pos.x + NW;
      ay = coupleCenters[key] ? coupleCenters[key].y : pos.y + NH / 2;
    }
    const bx = orientationTop ? ax : ax + GAP_Y / 2;
    const by = orientationTop ? ay + GAP_Y / 2 : ay;
    buttonPos[key] = { ax, ay, bx, by, count: childCountMap[key] || 0 };
  });

  // ─── Connecteurs ────────────────────────────────────
  members.forEach(m => {
    const pos = positions[m.id];
    if(!pos) return;

    // Connexion parent → enfant : part du bouton collapse/expand du parent (pas du parent lui-même)
    if (m.parentId && positions[m.parentId]) {
      const parentKey = entityKeyOf(m.parentId);
      const btn = buttonPos[parentKey];
      let startX, startY;
      if (btn) {
        startX = btn.bx;
        startY = btn.by;
      } else {
        const parent = members.find(p => p.id === m.parentId);
        const hasSpouse = parent && parent.spouseId && positions[parent.spouseId];
        if (hasSpouse && coupleCenters[parent.id]) {
          startX = coupleCenters[parent.id].x;
          startY = coupleCenters[parent.id].y;
        } else {
          const pp = positions[parent.id];
          startX = orientationTop ? pp.x + NW / 2 : pp.x + NW;
          startY = orientationTop ? pp.y + NH : pp.y + NH / 2;
        }
      }
      const endX = orientationTop ? pos.x + NW / 2 : pos.x;
      const endY = orientationTop ? pos.y : pos.y + NH / 2;
      const midY = (startY + endY) / 2, midX = (startX + endX) / 2;
      const col = genColor(genMemo[m.id] - 1);
      const path = orientationTop
        ? `M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`
        : `M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`;
      connectors += `<path class="link-path" data-child="${m.id}" d="${path}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-opacity=".55"/>`;
    }

    // lien de couple + cœur
    if(m.spouseId && positions[m.spouseId] && m.id < m.spouseId) {
      const sp = positions[m.spouseId];
      let cx, cy;
      if (settings.orientation === 'top') {
        connectors += `<line x1="${pos.x+NW}" y1="${pos.y+NH/2}" x2="${sp.x}" y2="${sp.y+NH/2}" stroke="#c9bfa8" stroke-width="1.6" stroke-dasharray="1.5,5" stroke-linecap="round" stroke-opacity=".85"/>`;
        cx = (pos.x + NW + sp.x) / 2; cy = pos.y + NH/2;
      } else {
        connectors += `<line x1="${pos.x+NW/2}" y1="${pos.y+NH}" x2="${sp.x+NW/2}" y2="${sp.y}" stroke="#c9bfa8" stroke-width="1.6" stroke-dasharray="1.5,5" stroke-linecap="round" stroke-opacity=".85"/>`;
        cx = pos.x + NW/2; cy = (pos.y + NH + sp.y) / 2;
      }
      connectors += svgHeart(cx, cy);
    }
  });

  // ─── Nœuds ──────────────────────────────────────────────
  const GENDER_GLYPH = { F: '♀', M: '♂', N: '⊙' };
  members.forEach(m => {
    const pos = positions[m.id];
    if (!pos) return;
    const g = genMemo[m.id];
    const col = genColor(g);
    const ini = initials(m);
    const hasPhoto = m.photo && m.photo.length > 5;

    const cardX = pos.x, cardY = pos.y;
    const centerX = cardX + NW / 2;

    // Avatar circulaire, chevauchant le bandeau supérieur
    const R = 40;
    const avCx = centerX;
    const avCy = cardY + 22 + R;

    nodes += `<g class="node-group" data-id="${m.id}" onclick="openDetail('${m.id}')" oncontextmenu="openEditFromNode(event,'${m.id}')">`;

    // Fond de la carte
    nodes += `<rect class="node-rect" x="${cardX}" y="${cardY}" width="${NW}" height="${NH}" rx="${NRX}" fill="${PARCHMENT}" stroke="${col}" stroke-width="1.4" filter="url(#shadow)"/>`;

    // Bandeau supérieur — accent de génération (coins arrondis)
    nodes += `<path d="M${cardX},${cardY+NRX} A${NRX},${NRX} 0 0 1 ${cardX+NRX},${cardY} L${cardX+NW-NRX},${cardY} A${NRX},${NRX} 0 0 1 ${cardX+NW},${cardY+NRX} L${cardX+NW},${cardY+26} L${cardX},${cardY+26} Z" fill="${col}" opacity=".92"/>`;

    // Anneau + fond de l'avatar
    nodes += `<circle cx="${avCx}" cy="${avCy}" r="${R+4}" fill="${PARCHMENT}"/>`;
    nodes += `<circle cx="${avCx}" cy="${avCy}" r="${R}" fill="${col}" opacity=".1"/>`;

    if (hasPhoto) {
      const clipId = `pc-${m.id}`;
      defs += `<clipPath id="${clipId}"><circle cx="${avCx}" cy="${avCy}" r="${R}"/></clipPath>`;
      nodes += `<image href="${m.photo}" x="${avCx-R}" y="${avCy-R}" width="${R*2}" height="${R*2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      nodes += `<text x="${avCx}" y="${avCy+1}" text-anchor="middle" dominant-baseline="middle" fill="${col}" opacity=".85" font-family="'Playfair Display',Georgia,serif" font-size="30" font-weight="600" style="pointer-events:none">${(ini||'').toUpperCase()}</text>`;
    }
    // Anneau coloré
    nodes += `<circle cx="${avCx}" cy="${avCy}" r="${R}" fill="none" stroke="${col}" stroke-width="2.5"/>`;

    // Pastille de genre
    const gx = avCx + R * 0.72, gy = avCy + R * 0.72;
    nodes += `<circle cx="${gx}" cy="${gy}" r="11" fill="${PARCHMENT}" stroke="${col}" stroke-width="1.5"/>`;
    nodes += `<text x="${gx}" y="${gy+1}" text-anchor="middle" dominant-baseline="middle" fill="${col}" font-size="12" style="pointer-events:none">${GENDER_GLYPH[m.gender] || '⊙'}</text>`;

    // Prénom
    const nameY = avCy + R + 24;
    nodes += `<text x="${centerX}" y="${nameY}" fill="${col}" font-family="'Playfair Display',Georgia,serif" font-size="16" font-weight="600" text-anchor="middle" style="pointer-events:none">${truncate(m.firstname, 15)}</text>`;

    // Nom (majuscules discrètes)
    nodes += `<text x="${centerX}" y="${nameY + 21}" fill="#5c5344" font-family="'DM Sans',system-ui,sans-serif" font-size="12" font-weight="500" letter-spacing="0.06em" text-anchor="middle" style="pointer-events:none">${truncate((m.lastname || '').toUpperCase(), 16)}</text>`;

    // Dates
    if (m.birth) {
      const yr = m.birth.slice(0, 4) + (m.death ? ' – ' + m.death.slice(0, 4) : '');
      nodes += `<text x="${centerX}" y="${nameY + 42}" fill="#8a7d68" font-family="'DM Sans',system-ui,sans-serif" font-size="11" text-anchor="middle" style="pointer-events:none">${yr}</text>`;
    }

    // Croix pour décès (sur le bandeau, en haut à droite)
    if (m.death) {
      nodes += `<text x="${cardX + NW - 15}" y="${cardY + 22}" fill="#ffffff" opacity=".9" font-size="14" text-anchor="middle" style="pointer-events:none">†</text>`;
    }

    nodes += `</g>`;
  });

  // ─── Boutons collapse/expand (entre parent et enfants) ──
  Object.keys(buttonPos).forEach(key => {
    const { ax, ay, bx, by, count } = buttonPos[key];
    const isCollapsed = collapsed.has(key);
    const col = genColor(genMemo[key] ?? 0);
    const r = count > 1 ? 16 : 13;
    const fontSize = count > 1 ? 14 : 12;

    connectors += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="1.6" stroke-opacity=".4"/>`;
    connectors += `<circle class="collapse-btn" data-key="${key}" cx="${bx}" cy="${by}" r="${r}" fill="#ffffff" stroke="${col}" stroke-width="1.6" filter="url(#shadow)" style="cursor:pointer" onclick="toggleCollapse('${key}')"/>`;
    const arrow = orientationTop
      ? (isCollapsed ? '▸' : '▾')
      : (isCollapsed ? '▾' : '▸');
    connectors += `<text x="${bx}" y="${by + fontSize/3}" text-anchor="middle" font-size="${fontSize}" fill="${col}" style="pointer-events:none">${arrow}</text>`;
  });

  defs += '</defs>';
  svg.innerHTML = defs + connectors + nodes;
  applyTransform();
  lastPositions = positions;
  lastButtonPos = buttonPos;
}

/** Placeholder SVG élégant avec initiales + icône genre */
function svgPlaceholder(cx, cy, r, col, ini, gender) {
  const genderSymbol = gender === 'F' ? '♀' : gender === 'M' ? '♂' : '⊙';
  return `
    <g style="pointer-events:none">
      <circle cx="${cx}" cy="${cy}" r="${r - 1}" fill="${col}" opacity=".08"/>
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" dominant-baseline="middle"
        fill="${col}" opacity=".85"
        font-family="'Playfair Display',Georgia,serif"
        font-size="${r * 0.8}" font-weight="600">${ini.toUpperCase()}</text>
      <text x="${cx + r - 6}" y="${cy + r - 8}" text-anchor="middle"
        fill="${col}" opacity=".55" font-size="12">${genderSymbol}</text>
    </g>`;
}

function svgPlaceholderSquare(x, y, size, col, ini, gender) {
  const genderSymbol = gender === 'F' ? '♀' : gender === 'M' ? '♂' : '⊙';
  return `
    <g style="pointer-events:none">
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="6" fill="${col}" opacity=".08"/>
      <text x="${x + size/2}" y="${y + size/2 + 4}" text-anchor="middle" dominant-baseline="middle"
        fill="${col}" opacity=".85"
        font-family="'Playfair Display',Georgia,serif"
        font-size="${size * 0.45}" font-weight="600">${ini.toUpperCase()}</text>
      <text x="${x + size - 10}" y="${y + size - 10}" text-anchor="middle"
        fill="${col}" opacity=".55" font-size="12">${genderSymbol}</text>
    </g>`;
}

/** Petit cœur dessiné (remplace l'emoji, rendu homogène) */
function svgHeart(cx, cy) {
  return `<g style="pointer-events:none" transform="translate(${cx},${cy})">
    <circle r="12" fill="${PARCHMENT}" stroke="#e4d9bf" stroke-width="1"/>
    <path transform="scale(1.05)" d="M0 3.4 C -5.6 -1.6 -8.4 -5.4 -5.2 -8 C -3 -9.7 -0.6 -8.2 0 -6 C 0.6 -8.2 3 -9.7 5.2 -8 C 8.4 -5.4 5.6 -1.6 0 3.4 Z" fill="#c0563f"/>
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

  // 0. Exclure les descendants d'une entité repliée (collapse)
  const hidden = computeHiddenIds();
  const treeMembers = members.filter(m => !hidden.has(m.id));
  if (treeMembers.length === 0) return positions;

  // 1. Generation for each member (unchanged)
  const genMemo = {};
  members.forEach(m => getGen(m.id, genMemo));

  // 2. Build spouse pairs (couples)
  const coupleMap = {};       // memberId → entityId (primary)
  const couples = [];         // { primary, secondary, members: [id1,id2] }
  const processed = new Set();

  treeMembers.forEach(m => {
    if (m.spouseId && !processed.has(m.id) && !processed.has(m.spouseId)) {
      const spouse = treeMembers.find(x => x.id === m.spouseId);
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
  treeMembers.forEach(m => {
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
      width: settings.orientation === 'top' ? (2 * NW + GAP_X) : (2 * NH + GAP_X),
      gen: genMemo[c.primary]
    };
    entities.push(entity);
    entityMap[c.primary] = entity;
  });

  // Singles
  treeMembers.forEach(m => {
    if (coupleMap[m.id] === m.id && !entityMap[m.id]) {
      const entity = {
        id: m.id,
        members: [m.id],
        isCouple: false,
        width: settings.orientation === 'top' ? NW : NH,
        gen: genMemo[m.id]
      };
      entities.push(entity);
      entityMap[m.id] = entity;
    }
  });

  // 5. Build children map for entities (entityId → list of child member ids)
  const childMap = {};
  entities.forEach(e => childMap[e.id] = []);

  treeMembers.forEach(m => {
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
    const x = orientationTop ? primaryX : y;
    const yPos = orientationTop ? y : primaryX;

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
    const [primary, secondary] = entity.members.sort();
    positions[primary] = { x, y };
    if (settings.orientation === 'top') {
      positions[secondary] = { x: x + NW + GAP_X, y };
    } else {
      positions[secondary] = { x, y: y + NH + GAP_X };
    }
  } else {
    positions[entity.members[0]] = { x, y };
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
function applyTransform() {
  document.getElementById('tree-svg').style.transform=`scale(${scale})`;
  const lbl = document.getElementById('zoom-level');
  if (lbl) lbl.textContent = Math.round(scale * 100) + '%';
}
function zoomIn()  { scale=Math.min(3,scale+0.12); applyTransform(); }
function zoomOut() { scale=Math.max(0.3,scale-0.12); applyTransform(); }
function resetZoom() { scale=1; applyTransform(); }
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
  $('#f-parent').val(m.parentId || '').trigger('change');
  $('#f-spouse').val(m.spouseId || '').trigger('change');
  const gv=m.gender||'M';
  document.querySelectorAll('input[name="gender"]').forEach(r=>r.checked=r.value===gv);
  if(typeof renderPhotoThumb==='function') renderPhotoThumb(m.photo||null);
}

function resetForm() {
  ['f-firstname','f-lastname','f-birth','f-birthplace','f-death','f-deathplace','f-notes','f-photo','f-photo-file']
    .forEach(id=>{ document.getElementById(id).value=''; });
  $('#f-parent').val('').trigger('change');
  $('#f-spouse').val('').trigger('change');
  document.getElementById('g-m').checked=true;
  if(typeof renderPhotoThumb==='function') renderPhotoThumb(null);
}

function populateSelects(excludeId) {
  const parentSelect = document.getElementById('f-parent');
  const spouseSelect = document.getElementById('f-spouse');
  const membersList = members.filter(m => m.id !== excludeId).sort(compareMembers);

  const options = membersList.map(m => `<option value="${m.id}">${escapeHtml(getMemberFullName(m))}</option>`).join('');
  parentSelect.innerHTML = `<option value="">— Aucun (ancêtre racine) —</option>` + options;
  spouseSelect.innerHTML = `<option value="">— Aucun —</option>` + options;

  // Réinitialiser Select2
  $(parentSelect).select2('destroy').select2({ placeholder: 'Rechercher un parent…', allowClear: true, theme: 'bootstrap-5', width: '100%' });
  $(spouseSelect).select2('destroy').select2({ placeholder: 'Rechercher un conjoint(e)…', allowClear: true, theme: 'bootstrap-5', width: '100%' });
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
  const parentId = $('#f-parent').val() || null;
  const spouseId = $('#f-spouse').val() || null;
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
          fill="${col}" font-family="'Playfair Display',Georgia,serif"
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
  buildFamilyPhotosForPerson(m);
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
        :`<span style="font-family:'Playfair Display',serif;font-size:12px;font-weight:600;color:${col};">${initials(person).toUpperCase()}</span>`;
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

function buildFamilyPhotosForPerson(m) {
  const container = document.getElementById('detail-family-photos');
  if (!container) return;

  // Filtrer les photos de famille où cette personne est impliquée
  const photos = familyPhotos.filter(fp => {
    const head = members.find(x => x.id === fp.memberId);
    if (!head) return false;
    // Chef de famille
    if (fp.memberId === m.id) return true;
    // Conjoint(e) du chef
    if (head.spouseId === m.id) return true;
    // Enfant du chef
    if (m.parentId === fp.memberId) return true;
    return false;
  });

  if (photos.length === 0) {
    container.innerHTML = ''; // on cache si vide
    return;
  }

  container.innerHTML = `
    <h3 style="font-size:var(--text-xs);font-weight:var(--font-bold);text-transform:uppercase;letter-spacing:var(--tracking-wider);color:var(--text-light);margin-bottom:9px;">📷 Photos de famille</h3>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${photos.map(fp => `
        <div style="cursor:pointer;border-radius:8px;overflow:hidden;width:80px;height:80px;border:1px solid var(--border);flex-shrink:0;" 
             onclick="openFamilyPhotoView(${fp.id})" title="${escapeHtml(fp.histoire || 'Photo de famille')}">
          <img src="${fp.photo}" style="width:100%;height:100%;object-fit:cover;" alt="Photo de famille" onerror="this.style.display='none'"/>
        </div>
      `).join('')}
    </div>
  `;
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
  const select = $('#fpf-member');
  let html = '<option value="">— Sélectionner —</option>';
  heads.forEach(h => {
      html += `<option value="${h.id}">${escapeHtml(getMemberFullName(h))}</option>`;
  });
  select.html(html);
  select.val(existing ? existing.memberId : '').trigger('change');
  select.prop('disabled', !!existing); // Désactiver en édition
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
    const headId = $('#fpf-member').val(); // maintenant c'est l'ID direct
    const box = document.getElementById('fpf-preview');
    if (!headId) { box.textContent = ''; return; }
    const list = getFamilyMembers(headId);
    box.textContent = 'Personnes sur cette photo : ' + list.map(m => getMemberFullName(m)).join(', ');
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

  const memberId = $('#fpf-member').val(); // c'est déjà l'ID
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
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('open');
        // Réinitialiser Select2 si présent dans la modale
        $(modal).find('.select2').each(function() {
            // Détruire puis recréer proprement
            $(this).select2('destroy');
            $(this).select2({
                placeholder: 'Rechercher un membre…',
                allowClear: true,
                width: '100%'
            });
        });
    }
}

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

function getMemberFullName(m) {
  return `${m.firstname || ''} ${m.lastname || ''}`.trim();
}