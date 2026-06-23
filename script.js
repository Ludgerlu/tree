/* ===================================================
   ARBRE GÉNÉALOGIQUE — script.js
   ================================================= */

'use strict';

/* ─── THÈMES ─────────────────────────────────────── */
const THEMES = [
  { name:'Sépia',    colors:['#7c5c2e','#3d6b4f','#2e5c8a','#8a3d5c','#5c3d8a'] },
  { name:'Forêt',    colors:['#2d5a27','#1a6b5c','#4a7a2e','#2d4a1a','#5c7a3d'] },
  { name:'Océan',    colors:['#1a4a7a','#0d6b8a','#2e3d8a','#0d5c7a','#1a2e6b'] },
  { name:'Crépusc.', colors:['#7a2e5c','#8a3d2e','#6b2e7a','#5c1a3d','#7a3d1a'] },
  { name:'Ardoise',  colors:['#3d4a5c','#2e3d4a','#4a5c6b','#3d5c5c','#2e4a5c'] },
];

let currentTheme = 0;
let treeName = 'Ma Famille';
let orientation = 'top'; // 'top' | 'left'
let editingId = null;
let detailId = null;
let zoomLevel = 1;

/* ─── DONNÉES ────────────────────────────────────── */
let members = [];
let nextId = 1;

function loadDemo() {
  members = [
    {id:1, pid:null, spouseId:2, firstname:'Jean-Baptiste', lastname:'Moreau', birth:'1918-04-10', birthplace:'Lyon, France', death:'1988-11-23', deathplace:'Paris, France', gender:'M', notes:'Agriculteur puis artisan. Fondateur de la famille Moreau.', photo:''},
    {id:2, pid:null, spouseId:1, firstname:'Germaine', lastname:'Moreau', birth:'1921-09-03', birthplace:'Dijon, France', death:'1995-02-14', deathplace:'Lyon, France', gender:'F', notes:'Couturière renommée dans sa région.', photo:''},
    {id:3, pid:1, spouseId:8, firstname:'Pierre', lastname:'Moreau', birth:'1945-06-15', birthplace:'Lyon, France', death:null, deathplace:'', gender:'M', notes:'Ingénieur en génie civil.', photo:''},
    {id:4, pid:1, spouseId:null, firstname:'Lucie', lastname:'Moreau', birth:'1948-02-28', birthplace:'Lyon, France', death:null, deathplace:'', gender:'F', notes:'Professeure de lettres classiques.', photo:''},
    {id:5, pid:2, spouseId:9, firstname:'Henri', lastname:'Moreau', birth:'1951-11-07', birthplace:'Dijon, France', death:'2015-08-19', deathplace:'Marseille, France', gender:'M', notes:'Musicien et compositeur amateur.', photo:''},
    {id:6, pid:2, spouseId:null, firstname:'Élise', lastname:'Moreau', birth:'1955-03-22', birthplace:'Dijon, France', death:null, deathplace:'', gender:'F', notes:'Médecin généraliste.', photo:''},
    {id:7, pid:4, spouseId:null, firstname:'Mathieu', lastname:'Dupont', birth:'1972-08-30', birthplace:'Bordeaux, France', death:null, deathplace:'', gender:'M', notes:'Chef cuisinier étoilé.', photo:''},
    {id:8, pid:null, spouseId:3, firstname:'Claire', lastname:'Laurent', birth:'1947-01-19', birthplace:'Rennes, France', death:null, deathplace:'', gender:'F', notes:'Architecte paysagiste.', photo:''},
    {id:9, pid:null, spouseId:5, firstname:'Sylvie', lastname:'Renard', birth:'1953-07-04', birthplace:'Nantes, France', death:null, deathplace:'', gender:'F', notes:'Bibliothécaire.', photo:''},
    {id:10, pid:3, spouseId:null, firstname:'Sophie', lastname:'Moreau', birth:'1970-12-01', birthplace:'Paris, France', death:null, deathplace:'', gender:'F', notes:'Journaliste de presse écrite.', photo:''},
    {id:11, pid:3, spouseId:null, firstname:'Marc', lastname:'Moreau', birth:'1973-05-18', birthplace:'Paris, France', death:null, deathplace:'', gender:'M', notes:'Développeur web freelance.', photo:''},
    {id:12, pid:5, spouseId:null, firstname:'Thomas', lastname:'Moreau', birth:'1978-09-25', birthplace:'Marseille, France', death:null, deathplace:'', gender:'M', notes:'Vétérinaire.', photo:''},
    {id:13, pid:5, spouseId:null, firstname:'Camille', lastname:'Moreau', birth:'1982-03-11', birthplace:'Marseille, France', death:null, deathplace:'', gender:'F', notes:'Danseuse professionnelle.', photo:''},
    {id:14, pid:10, spouseId:null, firstname:'Chloé', lastname:'Martin', birth:'1995-07-14', birthplace:'Paris, France', death:null, deathplace:'', gender:'F', notes:'Étudiante en médecine.', photo:''},
    {id:15, pid:10, spouseId:null, firstname:'Liam', lastname:'Martin', birth:'1998-02-28', birthplace:'Paris, France', death:null, deathplace:'', gender:'M', notes:'Musicien en herbe.', photo:''},
    {id:16, pid:11, spouseId:null, firstname:'Emma', lastname:'Moreau', birth:'2000-10-07', birthplace:'Toulouse, France', death:null, deathplace:'', gender:'F', notes:'Lycéenne passionnée de robotique.', photo:''},
    {id:17, pid:12, spouseId:null, firstname:'Nathan', lastname:'Moreau', birth:'2002-06-30', birthplace:'Marseille, France', death:null, deathplace:'', gender:'M', notes:'Apprenti boulanger.', photo:''},
    {id:18, pid:14, spouseId:null, firstname:'Zoé', lastname:'Martin', birth:'2019-04-11', birthplace:'Paris, France', death:null, deathplace:'', gender:'F', notes:'', photo:''},
    {id:19, pid:15, spouseId:null, firstname:'Lucas', lastname:'Martin', birth:'2021-11-03', birthplace:'Brest, France', death:null, deathplace:'', gender:'M', notes:'', photo:''},
    {id:20, pid:16, spouseId:null, firstname:'Mia', lastname:'Moreau', birth:'2022-07-22', birthplace:'Toulouse, France', death:null, deathplace:'', gender:'F', notes:'', photo:''},
  ];
  nextId = 21;
}

/* ─── PERSISTANCE ────────────────────────────────── */
function saveToStorage() {
  try {
    localStorage.setItem('genTree_members', JSON.stringify(members));
    localStorage.setItem('genTree_nextId', nextId);
    localStorage.setItem('genTree_name', treeName);
    localStorage.setItem('genTree_theme', currentTheme);
  } catch(e) { console.warn('LocalStorage non disponible.'); }
}

function loadFromStorage() {
  try {
    const m = localStorage.getItem('genTree_members');
    if (m) { members = JSON.parse(m); nextId = parseInt(localStorage.getItem('genTree_nextId')) || 1; }
    else { loadDemo(); }
    treeName = localStorage.getItem('genTree_name') || 'Ma Famille';
    currentTheme = parseInt(localStorage.getItem('genTree_theme')) || 0;
  } catch(e) { loadDemo(); }
}

/* ─── UTILITAIRES ────────────────────────────────── */
function getGen(id, depth=0) {
  if (depth > 10) return 0;
  const m = members.find(x=>x.id===id);
  if (!m || m.pid === null) return 0;
  return 1 + getGen(m.pid, depth+1);
}

function getChildren(pid) {
  return members.filter(m => m.pid === pid);
}

function getMember(id) {
  return members.find(m => m.id === id) || null;
}

function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function getAge(birth, death) {
  if (!birth) return null;
  const b = new Date(birth);
  const d = death ? new Date(death) : new Date();
  const age = Math.floor((d - b) / (365.25 * 24 * 3600 * 1000));
  return age >= 0 ? age : null;
}

function initials(m) {
  return ((m.firstname[0]||'') + (m.lastname[0]||'')).toUpperCase();
}

function applyTheme(idx) {
  const t = THEMES[idx] || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--gen0', t.colors[0]);
  r.setProperty('--gen1', t.colors[1]);
  r.setProperty('--gen2', t.colors[2]);
  r.setProperty('--gen3', t.colors[3]);
  r.setProperty('--gen4', t.colors[4]);
  r.setProperty('--accent', t.colors[0]);
  r.setProperty('--accent-dark', shadeColor(t.colors[0], -20));

  const lights = t.colors.map(c => lightenColor(c, 88));
  lights.forEach((l,i) => r.setProperty(`--gen${i}-light`, l));
  currentTheme = idx;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + percent));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (num & 0xff) + percent));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function lightenColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + Math.round((255 - (num >> 16)) * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round((255 - ((num >> 8) & 0xff)) * percent / 100));
  const b = Math.min(255, (num & 0xff) + Math.round((255 - (num & 0xff)) * percent / 100));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function genColor(gen) {
  const g = Math.min(gen, 4);
  return getComputedStyle(document.documentElement).getPropertyValue(`--gen${g}`).trim();
}
function genLight(gen) {
  const g = Math.min(gen, 4);
  return getComputedStyle(document.documentElement).getPropertyValue(`--gen${g}-light`).trim();
}

/* ─── LAYOUT ─────────────────────────────────────── */
const NW = 148, NH = 66, GX = 28, GY = 88;

function subtreeWidth(id) {
  const ch = getChildren(id);
  if (ch.length === 0) return NW + GX;
  return ch.reduce((s, c) => s + subtreeWidth(c.id), 0);
}

function layoutNode(id, x, y, positions) {
  positions[id] = { x, y };
  const ch = getChildren(id);
  if (ch.length === 0) return;
  const total = ch.reduce((s,c) => s + subtreeWidth(c.id), 0);
  let cx = x - total / 2 + NW / 2;
  ch.forEach(c => {
    const sw = subtreeWidth(c.id);
    layoutNode(c.id, cx + sw / 2 - NW / 2, y + NH + GY, positions);
    cx += sw;
  });
}

function computeLayout() {
  const positions = {};
  const roots = members.filter(m => m.pid === null);
  let ox = 50;
  roots.forEach(r => {
    const sw = subtreeWidth(r.id);
    layoutNode(r.id, ox + sw / 2 - NW / 2, 40, positions);
    ox += sw + GX;
  });
  return positions;
}

/* ─── RENDU SVG ──────────────────────────────────── */
const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs={}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
  return el;
}

function svgText(text, attrs={}) {
  const el = svgEl('text', attrs);
  el.textContent = text;
  return el;
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max-1) + '…' : str;
}

function render() {
  const svg = document.getElementById('tree-svg');
  svg.innerHTML = '';

  const empty = document.getElementById('empty-state');
  if (members.length === 0) {
    empty.classList.add('show');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    updateMemberCount();
    return;
  }
  empty.classList.remove('show');

  const positions = computeLayout();

  // Calcul dimensions
  let maxX = 0, maxY = 0;
  Object.values(positions).forEach(p => {
    maxX = Math.max(maxX, p.x + NW + 60);
    maxY = Math.max(maxY, p.y + NH + 60);
  });
  svg.setAttribute('width', maxX);
  svg.setAttribute('height', maxY);

  // ── LIGNES ──
  const lineG = svgEl('g', { id:'lines-layer' });
  members.forEach(m => {
    if (m.pid === null) return;
    const p = positions[m.pid];
    const c = positions[m.id];
    if (!p || !c) return;
    const gen = getGen(m.id);
    const col = genColor(gen);
    const px = p.x + NW / 2, py = p.y + NH;
    const cx = c.x + NW / 2, cy = c.y;
    const my = py + GY / 2;
    const path = svgEl('path', {
      d: `M${px},${py} L${px},${my} L${cx},${my} L${cx},${cy}`,
      fill: 'none',
      stroke: col,
      'stroke-width': '1.5',
      'stroke-opacity': '0.4',
      'stroke-linecap': 'round',
    });
    lineG.appendChild(path);

    // Petits cercles aux jonctions
    const dot1 = svgEl('circle', { cx: px, cy: py, r:'3', fill: col, opacity:'0.35' });
    const dot2 = svgEl('circle', { cx: cx, cy: cy, r:'3', fill: col, opacity:'0.35' });
    lineG.appendChild(dot1);
    lineG.appendChild(dot2);
  });

  // ── LIENS CONJOINTS ──
  const spouseG = svgEl('g', { id:'spouse-layer' });
  const drawn = new Set();
  members.forEach(m => {
    if (!m.spouseId) return;
    const key = [Math.min(m.id,m.spouseId), Math.max(m.id,m.spouseId)].join('-');
    if (drawn.has(key)) return;
    drawn.add(key);
    const pa = positions[m.id];
    const pb = positions[m.spouseId];
    if (!pa || !pb) return;
    const ax = pa.x + NW / 2, ay = pa.y + NH / 2;
    const bx = pb.x + NW / 2, by = pb.y + NH / 2;
    const line = svgEl('line', {
      x1: ax, y1: ay, x2: bx, y2: by,
      stroke: '#b0a595', 'stroke-width': '1', 'stroke-dasharray': '4 3', opacity: '0.7'
    });
    spouseG.appendChild(line);
    // Cœur au milieu
    const mx = (ax + bx) / 2, my2 = (ay + by) / 2;
    const ht = svgText('♥', {
      x: mx, y: my2,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': '10',
      fill: '#b0a595',
      opacity: '0.8',
    });
    spouseG.appendChild(ht);
  });

  svg.appendChild(spouseG);
  svg.appendChild(lineG);

  // ── NŒUDS ──
  const nodesG = svgEl('g', { id:'nodes-layer' });

  members.forEach(m => {
    const pos = positions[m.id];
    if (!pos) return;
    const gen = getGen(m.id);
    const col = genColor(gen);
    const light = genLight(gen);
    const isFemale = m.gender === 'F';

    const g = svgEl('g', { class:'node-group', 'data-id': m.id });
    g.style.cursor = 'pointer';

    // Ombre
    const shadow = svgEl('rect', {
      x: pos.x + 2, y: pos.y + 3,
      width: NW, height: NH,
      rx: 10,
      fill: 'rgba(0,0,0,0.07)',
    });
    g.appendChild(shadow);

    // Fond de la carte
    const rect = svgEl('rect', {
      class: 'node-rect',
      x: pos.x, y: pos.y,
      width: NW, height: NH,
      rx: 10,
      fill: light,
      stroke: col,
      'stroke-width': '1.5',
    });
    g.appendChild(rect);

    // Barre latérale genre
    const sideBar = svgEl('rect', {
      x: pos.x, y: pos.y,
      width: 5, height: NH,
      rx: 4,
      fill: isFemale ? '#8a3d5c' : col,
    });
    g.appendChild(sideBar);

    // Masque la moitié droite de la barre (pour rx ne s'applique qu'à gauche)
    const sideBarCover = svgEl('rect', {
      x: pos.x + 2, y: pos.y,
      width: 5, height: NH,
      fill: light,
    });
    g.appendChild(sideBarCover);

    // Avatar (cercle + initiales ou photo)
    const avX = pos.x + 20, avY = pos.y + NH / 2, avR = 18;
    const avCircle = svgEl('circle', {
      cx: avX, cy: avY, r: avR,
      fill: isFemale ? lightenColor('#8a3d5c', 82) : light,
      stroke: isFemale ? '#8a3d5c' : col,
      'stroke-width': '1.5',
    });
    g.appendChild(avCircle);

    if (m.photo) {
      // Clip pour image ronde
      const clipId = `clip-${m.id}`;
      const clip = svgEl('clipPath', { id: clipId });
      const clipCirc = svgEl('circle', { cx: avX, cy: avY, r: avR });
      clip.appendChild(clipCirc);
      svg.querySelector('defs') || svg.insertBefore(svgEl('defs'), svg.firstChild);
      svg.querySelector('defs').appendChild(clip);
      const img = svgEl('image', {
        href: m.photo,
        x: avX - avR, y: avY - avR,
        width: avR * 2, height: avR * 2,
        'clip-path': `url(#${clipId})`,
        preserveAspectRatio: 'xMidYMid slice',
      });
      g.appendChild(img);
    } else {
      const initT = svgText(initials(m), {
        x: avX, y: avY,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': '12',
        'font-weight': '600',
        'font-family': 'Playfair Display, serif',
        fill: isFemale ? '#8a3d5c' : col,
      });
      g.appendChild(initT);
    }

    // Prénom
    const nameStr = truncate(m.firstname, 11) + ' ' + truncate(m.lastname, 8);
    const nameT = svgText(nameStr, {
      x: pos.x + 46, y: pos.y + 18,
      'dominant-baseline': 'hanging',
      'font-size': '12',
      'font-weight': '500',
      'font-family': 'DM Sans, sans-serif',
      fill: shadeColor(col, -30),
    });
    g.appendChild(nameT);

    // Dates
    const birth = m.birth ? m.birth.slice(0,4) : '?';
    const death = m.death ? m.death.slice(0,4) : '';
    const dateStr = death ? `${birth} – ${death}` : (m.birth ? `✦ ${birth}` : '');
    if (dateStr) {
      const dateT = svgText(dateStr, {
        x: pos.x + 46, y: pos.y + 33,
        'dominant-baseline': 'hanging',
        'font-size': '10',
        'font-family': 'DM Sans, sans-serif',
        fill: col,
        opacity: '0.85',
      });
      g.appendChild(dateT);
    }

    // Badge génération
    const badgeX = pos.x + NW - 26, badgeY = pos.y + 3;
    const badge = svgEl('rect', {
      x: badgeX, y: badgeY, width: 23, height: 14, rx: 4, fill: col,
    });
    g.appendChild(badge);
    const badgeT = svgText(`G${gen+1}`, {
      x: badgeX + 11, y: badgeY + 7,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': '8',
      'font-weight': '600',
      'font-family': 'DM Sans, sans-serif',
      fill: '#ffffff',
    });
    g.appendChild(badgeT);

    // Décédé — indicateur croix
    if (m.death) {
      const crossT = svgText('†', {
        x: pos.x + NW - 8, y: pos.y + NH - 8,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': '11',
        fill: col,
        opacity: '0.6',
      });
      g.appendChild(crossT);
    }

    // Icône enfants si en a
    const chCount = getChildren(m.id).length;
    if (chCount > 0) {
      const chT = svgText(`${chCount} ↓`, {
        x: pos.x + 46, y: pos.y + NH - 10,
        'dominant-baseline': 'central',
        'font-size': '9',
        'font-family': 'DM Sans, sans-serif',
        fill: col,
        opacity: '0.6',
      });
      g.appendChild(chT);
    }

    // HOVER effect via JS
    g.addEventListener('mouseenter', () => {
      rect.setAttribute('filter', 'brightness(0.96)');
      rect.setAttribute('stroke-width', '2');
    });
    g.addEventListener('mouseleave', () => {
      rect.removeAttribute('filter');
      rect.setAttribute('stroke-width', '1.5');
    });

    // CLICK
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetail(m.id);
    });

    // CONTEXT MENU (clic droit)
    g.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openAddModal(m.id);
    });

    nodesG.appendChild(g);
  });

  svg.appendChild(nodesG);
  updateMemberCount();
}

function updateMemberCount() {
  const el = document.getElementById('member-count');
  el.textContent = `${members.length} membre${members.length !== 1 ? 's' : ''}`;
}

/* ─── ZOOM & PAN ──────────────────────────────────── */
function zoomIn() { setZoom(Math.min(zoomLevel + 0.15, 2.5)); }
function zoomOut() { setZoom(Math.max(zoomLevel - 0.15, 0.3)); }

function setZoom(level) {
  zoomLevel = level;
  document.getElementById('tree-svg').style.transform = `scale(${zoomLevel})`;
}

function fitView() {
  const wrap = document.getElementById('canvas-wrap');
  const svg = document.getElementById('tree-svg');
  const svgW = parseFloat(svg.getAttribute('width')) || 1;
  const svgH = parseFloat(svg.getAttribute('height')) || 1;
  const wrapW = wrap.clientWidth;
  const wrapH = wrap.clientHeight;
  const fit = Math.min(wrapW / svgW, wrapH / svgH, 1) * 0.9;
  setZoom(fit);
  document.getElementById('canvas-inner').scrollTo(0, 0);
}

// Scroll to zoom
document.getElementById('canvas-inner').addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.min(Math.max(zoomLevel + delta, 0.3), 2.5));
  }
}, { passive: false });

/* ─── MODAL MEMBRE ────────────────────────────────── */
function openAddModal(parentId) {
  editingId = null;
  document.getElementById('modal-heading').textContent = 'Nouveau membre';
  document.getElementById('f-firstname').value = '';
  document.getElementById('f-lastname').value = '';
  document.getElementById('f-birth').value = '';
  document.getElementById('f-birthplace').value = '';
  document.getElementById('f-death').value = '';
  document.getElementById('f-deathplace').value = '';
  document.getElementById('f-notes').value = '';
  document.getElementById('f-photo').value = '';
  document.querySelector('input[name="gender"][value="M"]').checked = true;
  document.getElementById('btn-delete').style.display = 'none';
  populateParentSelect(parentId, null);
  populateSpouseSelect(null, null);
  openModal('member-modal');
  setTimeout(() => document.getElementById('f-firstname').focus(), 120);
}

function openEdit(id) {
  const m = getMember(id);
  if (!m) return;
  editingId = id;
  document.getElementById('modal-heading').textContent = 'Modifier le membre';
  document.getElementById('f-firstname').value = m.firstname;
  document.getElementById('f-lastname').value = m.lastname;
  document.getElementById('f-birth').value = m.birth || '';
  document.getElementById('f-birthplace').value = m.birthplace || '';
  document.getElementById('f-death').value = m.death || '';
  document.getElementById('f-deathplace').value = m.deathplace || '';
  document.getElementById('f-notes').value = m.notes || '';
  document.getElementById('f-photo').value = m.photo || '';
  const gval = m.gender || 'M';
  const gr = document.querySelector(`input[name="gender"][value="${gval}"]`);
  if (gr) gr.checked = true;
  document.getElementById('btn-delete').style.display = 'block';
  populateParentSelect(m.pid, id);
  populateSpouseSelect(m.spouseId, id);
  openModal('member-modal');
}

function populateParentSelect(selectedPid, excludeId) {
  const sel = document.getElementById('f-parent');
  sel.innerHTML = '<option value="">— Aucun (ancêtre racine) —</option>';
  members.forEach(m => {
    if (m.id === excludeId) return;
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.firstname} ${m.lastname} (G${getGen(m.id)+1})`;
    if (m.id === selectedPid) opt.selected = true;
    sel.appendChild(opt);
  });
}

function populateSpouseSelect(selectedId, excludeId) {
  const sel = document.getElementById('f-spouse');
  sel.innerHTML = '<option value="">— Aucun —</option>';
  members.forEach(m => {
    if (m.id === excludeId) return;
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.firstname} ${m.lastname}`;
    if (m.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function saveMember() {
  const fn = document.getElementById('f-firstname').value.trim();
  const ln = document.getElementById('f-lastname').value.trim();
  if (!fn || !ln) { showToast('Le prénom et le nom sont requis.'); return; }

  const pid = document.getElementById('f-parent').value ? parseInt(document.getElementById('f-parent').value) : null;
  const spouseId = document.getElementById('f-spouse').value ? parseInt(document.getElementById('f-spouse').value) : null;
  const birth = document.getElementById('f-birth').value || null;
  const birthplace = document.getElementById('f-birthplace').value.trim() || '';
  const death = document.getElementById('f-death').value || null;
  const deathplace = document.getElementById('f-deathplace').value.trim() || '';
  const gender = document.querySelector('input[name="gender"]:checked')?.value || 'M';
  const notes = document.getElementById('f-notes').value.trim();
  const photo = document.getElementById('f-photo').value.trim();

  if (editingId) {
    const m = getMember(editingId);
    Object.assign(m, { firstname:fn, lastname:ln, pid, spouseId, birth, birthplace, death, deathplace, gender, notes, photo });
    showToast(`${fn} ${ln} modifié(e).`);
  } else {
    members.push({ id: nextId++, pid, spouseId, firstname:fn, lastname:ln, birth, birthplace, death, deathplace, gender, notes, photo });
    showToast(`${fn} ${ln} ajouté(e).`);
  }

  closeModal('member-modal');
  saveToStorage();
  render();
}

function confirmDelete() {
  if (!editingId) return;
  const m = getMember(editingId);
  const hasChildren = members.some(c => c.pid === editingId);
  const msg = hasChildren
    ? `Supprimer ${m.firstname} ${m.lastname} ? Ses enfants deviendront des racines.`
    : `Supprimer ${m.firstname} ${m.lastname} ?`;
  if (!confirm(msg)) return;

  if (hasChildren) members.forEach(c => { if (c.pid === editingId) c.pid = null; });
  // Retirer le lien conjoint
  members.forEach(c => { if (c.spouseId === editingId) c.spouseId = null; });
  members = members.filter(c => c.id !== editingId);
  closeModal('member-modal');
  saveToStorage();
  render();
  showToast('Membre supprimé.');
}

/* ─── MODAL DÉTAIL ────────────────────────────────── */
function openDetail(id) {
  const m = getMember(id);
  if (!m) return;
  detailId = id;
  const gen = getGen(id);
  const col = genColor(gen);
  const isFemale = m.gender === 'F';

  document.getElementById('detail-name').textContent = `${m.firstname} ${m.lastname}`;

  // Avatar
  const av = document.getElementById('detail-avatar');
  av.style.borderColor = col;
  av.style.background = isFemale ? lightenColor('#8a3d5c', 82) : genLight(gen);
  av.style.color = col;
  if (m.photo) {
    av.innerHTML = `<img src="${m.photo}" alt="${m.firstname}" onerror="this.style.display='none'"/>`;
  } else {
    av.innerHTML = initials(m);
    av.style.fontFamily = 'Playfair Display, serif';
  }

  // Dates
  const datesEl = document.getElementById('detail-dates');
  const age = getAge(m.birth, m.death);
  let dateStr = '';
  if (m.birth) dateStr += `✦ ${formatDate(m.birth)}`;
  if (m.birthplace) dateStr += ` · ${m.birthplace}`;
  if (m.death) { dateStr += `  †  ${formatDate(m.death)}`; if (m.deathplace) dateStr += ` · ${m.deathplace}`; }
  if (age !== null) dateStr += `  (${age} ans)`;
  datesEl.textContent = dateStr || '—';

  // Génération
  document.getElementById('detail-gen').textContent = `Génération ${gen+1}`;
  document.getElementById('detail-gen').style.background = genLight(gen);
  document.getElementById('detail-gen').style.color = col;
  document.getElementById('detail-gen').style.borderColor = col+'44';

  // Notes
  const notesEl = document.getElementById('detail-notes');
  notesEl.textContent = m.notes || '';

  // Famille
  const famEl = document.getElementById('detail-family');
  famEl.innerHTML = '';

  const parent = m.pid ? getMember(m.pid) : null;
  const spouse = m.spouseId ? getMember(m.spouseId) : null;
  const children = getChildren(id);
  const siblings = m.pid ? getChildren(m.pid).filter(c => c.id !== id) : [];

  const sections = [
    { label: 'Parent', list: parent ? [parent] : [], tag:'Parent' },
    { label: 'Conjoint(e)', list: spouse ? [spouse] : [], tag:'Conjoint' },
    { label: 'Frères & sœurs', list: siblings, tag:'Fratrie' },
    { label: 'Enfants', list: children, tag:'Enfant' },
  ];

  sections.forEach(s => {
    if (!s.list.length) return;
    const h3 = document.createElement('h3');
    h3.textContent = s.label;
    famEl.appendChild(h3);
    const ul = document.createElement('ul');
    ul.className = 'family-list';
    s.list.forEach(rel => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="family-tag">${s.tag}</span>${rel.firstname} ${rel.lastname}`;
      li.addEventListener('click', () => { closeModal('detail-modal'); openDetail(rel.id); });
      ul.appendChild(li);
    });
    famEl.appendChild(ul);
    famEl.appendChild(document.createElement('br'));
  });

  // Bouton ajouter enfant dans le footer
  document.getElementById('detail-edit-btn').onclick = editFromDetail;

  openModal('detail-modal');
}

function editFromDetail() {
  if (!detailId) return;
  closeModal('detail-modal');
  openEdit(detailId);
}

/* ─── PARAMÈTRES ──────────────────────────────────── */
function openSettings() {
  document.getElementById('s-treename').value = treeName;
  const picker = document.getElementById('theme-picker');
  picker.innerHTML = '';
  THEMES.forEach((t, i) => {
    const sw = document.createElement('div');
    sw.className = 'theme-swatch' + (i === currentTheme ? ' active' : '');
    sw.style.background = `linear-gradient(135deg, ${t.colors[0]} 50%, ${t.colors[1]} 50%)`;
    sw.title = t.name;
    sw.addEventListener('click', () => {
      picker.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      applyTheme(i);
      render();
    });
    picker.appendChild(sw);
  });

  const radios = document.querySelectorAll('input[name="orient"]');
  radios.forEach(r => { r.checked = r.value === orientation; });

  openModal('settings-modal');
}

function saveSettings() {
  treeName = document.getElementById('s-treename').value.trim() || 'Ma Famille';
  document.getElementById('tree-name-display').textContent = treeName;
  const radios = document.querySelectorAll('input[name="orient"]');
  radios.forEach(r => { if (r.checked) orientation = r.value; });
  saveToStorage();
  closeModal('settings-modal');
  showToast('Paramètres enregistrés.');
}

function clearAll() {
  if (!confirm('Effacer tous les membres ? Cette action est irréversible.')) return;
  members = [];
  nextId = 1;
  saveToStorage();
  closeModal('settings-modal');
  render();
  showToast('Données effacées.');
}

/* ─── EXPORT / IMPORT ─────────────────────────────── */
function openExport() {
  closeModal('member-modal');
  openModal('export-modal');
}

function exportJSON() {
  const data = { treeName, members, nextId, theme: currentTheme };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `arbre_${treeName.replace(/\s+/g,'_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  closeModal('export-modal');
  showToast('Fichier JSON téléchargé.');
}

function importData() {
  document.getElementById('file-input').click();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.members)) throw new Error('Format invalide.');
      members = data.members;
      nextId = data.nextId || (Math.max(...members.map(m=>m.id), 0) + 1);
      treeName = data.treeName || 'Ma Famille';
      if (data.theme !== undefined) { currentTheme = data.theme; applyTheme(currentTheme); }
      document.getElementById('tree-name-display').textContent = treeName;
      saveToStorage();
      render();
      showToast(`${members.length} membres importés.`);
    } catch(err) {
      alert('Fichier JSON invalide : ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function exportSVG() {
  const svgEl = document.getElementById('tree-svg');
  const clone = svgEl.cloneNode(true);
  // Intégrer les styles de base dans le SVG
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `text { font-family: 'DM Sans', sans-serif; }`;
  clone.insertBefore(style, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `arbre_${treeName.replace(/\s+/g,'_')}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
  closeModal('export-modal');
  showToast('SVG téléchargé.');
}

function printTree() {
  closeModal('export-modal');
  window.print();
}

/* ─── MODALS (UTILS) ──────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  el.classList.add('open');
  // Fermer si clic sur l'overlay
  el.addEventListener('click', function handler(e) {
    if (e.target === el) { closeModal(id); el.removeEventListener('click', handler); }
  });
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Touche Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ─── TOAST ───────────────────────────────────────── */
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ─── CLAVIER: RACCOURCIS ─────────────────────────── */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (e.key === '+' || e.key === '=') zoomIn();
  if (e.key === '-') zoomOut();
  if (e.key === '0') fitView();
  if (e.key === 'n' || e.key === 'N') openAddModal(null);
});

/* ─── CLIC SUR LE CANVAS (deselect) ─────────────── */
document.getElementById('canvas-inner').addEventListener('click', e => {
  if (e.target === document.getElementById('canvas-inner') || e.target === document.getElementById('tree-svg')) {
    // pas d'action
  }
});

/* ─── INIT ────────────────────────────────────────── */
loadFromStorage();
applyTheme(currentTheme);
document.getElementById('tree-name-display').textContent = treeName;
render();

// Ajuster la vue au chargement
setTimeout(fitView, 200);