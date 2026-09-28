/**
 * services/treeLayout.ts
 * Reprend fidèlement getGen(), layoutTree(), compareMembers(), initials(),
 * truncate() et formatDate() de l'ancien script.js.
 */
import { Member, Settings, Position } from '../types';
import { ThemeDefinition } from '../types/theme';

export const NW = 158;   // largeur d'un nœud
export const NH = 80;    // hauteur d'un nœud
export const NRX = 12;   // border-radius
export const GAP_X = 36;
export const GAP_Y = 100;
export const PHOTO_R = 22;

export function getGen(id: string, members: Member[], memo: Record<string, number> = {}): number {
  if (id in memo) return memo[id];
  const m = members.find((x) => x.id === id);
  if (!m || !m.parentId) {
    memo[id] = 0;
    return 0;
  }
  memo[id] = getGen(m.parentId, members, memo) + 1;
  return memo[id];
}

export function computeAllGens(members: Member[]): Record<string, number> {
  const memo: Record<string, number> = {};
  members.forEach((m) => getGen(m.id, members, memo));
  return memo;
}

export function initials(m: Pick<Member, 'firstname' | 'lastname'>): string {
  const f = (m.firstname || '').trim();
  const l = (m.lastname || '').trim();
  return (f[0] || '') + (l[0] || '');
}

export function compareMembers(a: Member, b: Member): number {
  const nameA = `${(a.lastname || '').trim()} ${(a.firstname || '').trim()}`.replace(/\s+/g, ' ').trim();
  const nameB = `${(b.lastname || '').trim()} ${(b.firstname || '').trim()}`.replace(/\s+/g, ' ').trim();
  return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
}

export function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const [y, mo, d] = iso.split('-');
  const mois = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'jun.', 'jui.', 'aoû.', 'sep.', 'oct.', 'nov.', 'déc.'];
  if (mo && d) return `${parseInt(d, 10)} ${mois[parseInt(mo, 10) - 1]} ${y}`;
  if (mo) return `${mois[parseInt(mo, 10) - 1]} ${y}`;
  return y;
}

/**
 * Positionnement hiérarchique top→down ou left→right selon settings.orientation.
 * BFS/récursif par niveau, centrage des sous-arbres — identique à l'algorithme original.
 */
export function layoutTree(members: Member[], settings: Settings): Record<string, Position> {
  const positions: Record<string, Position> = {};
  if (members.length === 0) return positions;

  const genMemo = computeAllGens(members);

  const childMap: Record<string, Member[]> = {};
  members.forEach((m) => {
    if (m.parentId) {
      childMap[m.parentId] = childMap[m.parentId] || [];
      childMap[m.parentId].push(m);
    }
  });

  const roots = members.filter((m) => !m.parentId).slice().sort(compareMembers);

  if (roots.length === 0) {
    // Repli : layout simple par génération si aucune racine n'est trouvée
    const byGen: Record<number, Member[]> = {};
    members.forEach((m) => {
      const g = genMemo[m.id];
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(m);
    });
    const gens = Object.keys(byGen).map(Number).sort((a, b) => a - b);
    gens.forEach((g) => {
      const row = byGen[g].slice().sort(compareMembers);
      row.forEach((m, i) => {
        positions[m.id] = { x: 40 + i * (NW + GAP_X), y: 40 + g * (NH + GAP_Y) };
      });
    });
    return positions;
  }

  const orientationTop = settings.orientation === 'top';
  const primarySize = orientationTop ? NW : NH;
  const primaryGap = GAP_X;
  const secondaryStep = orientationTop ? NH + GAP_Y : NW + GAP_Y;

  const extents: Record<string, { start: number; end: number }> = {};
  let nextPrimary = 40;

  function computeExtent(node: Member): { start: number; end: number } {
    const children = (childMap[node.id] || []).slice().sort(compareMembers);
    if (children.length === 0) {
      const start = nextPrimary;
      const end = start + primarySize;
      nextPrimary = end + primaryGap;
      extents[node.id] = { start, end };
      return extents[node.id];
    }
    const childExtents = children.map(computeExtent);
    const start = childExtents[0].start;
    const end = childExtents[childExtents.length - 1].end;
    extents[node.id] = { start, end };
    return extents[node.id];
  }

  function assignPositions(node: Member): void {
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

export function genColor(theme: ThemeDefinition, g: number, light = false): string {
  const keys: (keyof ThemeDefinition)[] = ['gen0', 'gen1', 'gen2', 'gen3', 'gen4'];
  const lkeys: (keyof ThemeDefinition)[] = ['gen0l', 'gen1l', 'gen2l', 'gen3l', 'gen4l'];
  const idx = Math.min(Math.max(g, 0), 4);
  return (light ? theme[lkeys[idx]] : theme[keys[idx]]) as string;
}

/* ─── Repli / dépli des branches & focus sur le chemin ─────────────── */

export function buildChildMap(members: Member[]): Record<string, Member[]> {
  const map: Record<string, Member[]> = {};
  members.forEach((m) => {
    if (m.parentId) {
      map[m.parentId] = map[m.parentId] || [];
      map[m.parentId].push(m);
    }
  });
  return map;
}

/** Tous les descendants (tous niveaux) d'un membre. */
export function getDescendantIds(members: Member[], id: string, childMap?: Record<string, Member[]>): string[] {
  const map = childMap ?? buildChildMap(members);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop() as string;
    (map[cur] || []).forEach((c) => {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        out.push(c.id);
        stack.push(c.id);
      }
    });
  }
  return out;
}

/** Membres affichés : tout sauf les descendants d'un nœud replié. */
export function getVisibleMembers(members: Member[], collapsed: ReadonlySet<string>): Member[] {
  if (collapsed.size === 0) return members;
  const map = buildChildMap(members);
  const hidden = new Set<string>();
  collapsed.forEach((id) => getDescendantIds(members, id, map).forEach((d) => hidden.add(d)));
  return members.filter((m) => !hidden.has(m.id));
}

/** Ancêtres d'un membre, du parent direct jusqu'à la racine. */
export function getAncestorIds(members: Member[], id: string): string[] {
  const byId = new Map(members.map((m) => [m.id, m] as [string, Member]));
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id);
  while (cur && cur.parentId && !seen.has(cur.parentId)) {
    out.push(cur.parentId);
    seen.add(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return out;
}

export interface FocusPath {
  nodes: Set<string>; // membre + ancêtres (+ conjoints de ces membres)
  links: Set<string>; // liens parent→enfant du chemin, clé "parentId>childId"
}

export function getFocusPath(members: Member[], id: string): FocusPath {
  const byId = new Map(members.map((m) => [m.id, m] as [string, Member]));
  const chain = [id].concat(getAncestorIds(members, id));
  const nodes = new Set<string>(chain);
  const links = new Set<string>();
  chain.forEach((cid, i) => {
    if (i > 0) links.add(`${cid}>${chain[i - 1]}`);
  });
  chain.forEach((cid) => {
    const sp = byId.get(cid)?.spouseId;
    if (sp) nodes.add(sp);
  });
  return { nodes, links };
}
