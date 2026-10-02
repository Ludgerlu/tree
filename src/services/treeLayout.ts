/**
 * services/treeLayout.ts
 * Reprend fidèlement getGen(), layoutTree(), compareMembers(), initials(),
 * truncate() et formatDate() de l'ancien script.js.
 */
import { Member, Settings, Position } from '../types';
import { ThemeDefinition } from '../types/theme';

export const NW = 200;          // largeur d'un nœud
export const NH = 90;          // hauteur d'un nœud
export const NRX = 10;        // border-radius
export const GAP_X = 60;     // écart horizontal entre nœuds
export const GAP_Y = 100;   // écart vertical entre nœuds
export const PHOTO_R = 22; // rayon de la photo (cercle)

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

export function compareSiblingsByBirth(a: Member, b: Member): number {
  if (a.birth && b.birth) {
    const byBirth = a.birth.localeCompare(b.birth);
    return byBirth || compareMembers(a, b);
  }
  if (a.birth) return -1;
  if (b.birth) return 1;
  return compareMembers(a, b);
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
  const orientationTop = settings.orientation === 'top';
  const primarySize = orientationTop ? NW : NH;
  const secondaryStep = orientationTop ? NH + GAP_Y : NW + GAP_Y;
  const primaryGap = GAP_X;
  const byId = new Map(members.map((member) => [member.id, member] as [string, Member]));

  interface LayoutUnit {
    id: string;
    partners: Member[];
    children: LayoutUnit[];
    generation: number;
    width: number;
    start: number;
  }

  const units: LayoutUnit[] = [];
  const unitByMember = new Map<string, LayoutUnit>();
  const parentUnitByUnit = new Map<LayoutUnit, LayoutUnit>();
  const visited = new Set<string>();

  members.forEach((member) => {
    if (visited.has(member.id)) return;
    const spouse = member.spouseId ? byId.get(member.spouseId) : undefined;
    const isSameGenerationSpouse = spouse && genMemo[spouse.id] === genMemo[member.id];
    const partners = isSameGenerationSpouse
      ? [member, spouse].sort(compareMembers)
      : [member];
    const unit: LayoutUnit = {
      id: partners[0].id,
      partners,
      children: [],
      generation: Math.min(...partners.map((partner) => genMemo[partner.id] ?? 0)),
      width: 0,
      start: 0,
    };
    units.push(unit);
    partners.forEach((partner) => {
      visited.add(partner.id);
      unitByMember.set(partner.id, unit);
    });
  });

  units.forEach((unit) => {
    const parentUnit = unit.partners
      .map((partner) => partner.parentId ? unitByMember.get(partner.parentId) : undefined)
      .find((candidate) => candidate && candidate !== unit);
    if (parentUnit) parentUnitByUnit.set(unit, parentUnit);
  });

  units.forEach((unit) => {
    const childUnits = new Set<LayoutUnit>();
    unit.partners.forEach((partner) => {
      (childMapForMember(members, partner.id)).forEach((child) => {
        const childUnit = unitByMember.get(child.id);
        if (childUnit && childUnit !== unit && parentUnitByUnit.get(childUnit) === unit) childUnits.add(childUnit);
      });
    });
    unit.children = Array.from(childUnits).sort(compareUnitsByBirth);
  });

  const roots = units.filter((unit) => !parentUnitByUnit.has(unit)).sort(compareUnitsByBirth);

  const visiting = new Set<LayoutUnit>();
  function measure(unit: LayoutUnit): number {
    if (visiting.has(unit)) return primarySize * unit.partners.length;
    visiting.add(unit);
    const partnerWidth = primarySize * unit.partners.length + primaryGap * (unit.partners.length - 1);
    const childWidths = unit.children.map(measure);
    const childWidth = childWidths.reduce((total, width) => total + width, 0) + primaryGap * Math.max(0, childWidths.length - 1);
    unit.width = Math.max(partnerWidth, childWidth);
    visiting.delete(unit);
    return unit.width;
  }

  function place(unit: LayoutUnit, start: number): void {
    unit.start = start;
    const partnerWidth = primarySize * unit.partners.length + primaryGap * (unit.partners.length - 1);
    const partnerStart = start + (unit.width - partnerWidth) / 2;
    unit.partners.forEach((partner, index) => {
      const primary = partnerStart + index * (primarySize + primaryGap);
      positions[partner.id] = orientationTop
        ? { x: primary, y: 40 + unit.generation * secondaryStep }
        : { x: 40 + unit.generation * secondaryStep, y: primary };
    });

    const childWidth = unit.children.reduce((total, child) => total + child.width, 0) + primaryGap * Math.max(0, unit.children.length - 1);
    let childStart = start + (unit.width - childWidth) / 2;
    unit.children.forEach((child) => {
      place(child, childStart);
      childStart += child.width + primaryGap;
    });
  }

  if (roots.length > 0) {
    roots.forEach(measure);
    let rootStart = 40;
    roots.forEach((root) => {
      place(root, rootStart);
      rootStart += root.width + primaryGap;
    });
  } else {
    // Malformed/cyclic trees fall back to generation rows while retaining spouse pairs.
    const byGeneration = new Map<number, LayoutUnit[]>();
    units.forEach((unit) => {
      const row = byGeneration.get(unit.generation) || [];
      row.push(unit);
      byGeneration.set(unit.generation, row);
    });
    Array.from(byGeneration.keys()).sort((a, b) => a - b).forEach((generation) => {
      let primary = 40;
      (byGeneration.get(generation) || []).sort(compareUnitsByBirth).forEach((unit) => {
        unit.partners.forEach((partner, index) => {
          const offset = primary + index * (primarySize + primaryGap);
          positions[partner.id] = orientationTop
            ? { x: offset, y: 40 + generation * secondaryStep }
            : { x: 40 + generation * secondaryStep, y: offset };
        });
        primary += primarySize * unit.partners.length + primaryGap * unit.partners.length;
      });
    });
  }

  return positions;
}

function childMapForMember(members: Member[], id: string): Member[] {
  return members.filter((member) => member.parentId === id);
}

function compareUnitsByBirth(a: { partners: Member[] }, b: { partners: Member[] }): number {
  const firstKnownBirth = (unit: { partners: Member[] }) => unit.partners
    .map((partner) => partner.birth)
    .filter((birth): birth is string => !!birth)
    .sort((first, second) => first.localeCompare(second))[0];
  const aBirth = firstKnownBirth(a);
  const bBirth = firstKnownBirth(b);
  if (aBirth && bBirth) {
    const byBirth = aBirth.localeCompare(bBirth);
    if (byBirth) return byBirth;
  } else if (aBirth) return -1;
  else if (bBirth) return 1;
  return compareMembers(a.partners[0], b.partners[0]);
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
