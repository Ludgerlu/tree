/**
 * components/TreeCanvas.tsx
 * Rendu SVG de l'arbre : connecteurs, nœuds, bouton replier/déplier (+/−) et
 * focus sur le chemin du membre sélectionné (les autres éléments sont floutés).
 */
import React, { useMemo } from 'react';
import { Member, Settings } from '../types';
import { THEMES } from '../services/themes';
import {
  buildChildMap,
  computeAllGens,
  genColor,
  getDescendantIds,
  getFocusPath,
  getVisibleMembers,
  initials,
  layoutTree,
  truncate,
} from '../services/treeLayout';

const NW = 158;
const NH = 80;
const NRX = 12;
const PHOTO_R = 22;
const BLUR_ID = 'tree-blur';

interface Props {
  members: Member[];
  settings: Settings;
  scale: number;
  svgRef: React.RefObject<SVGSVGElement>;
  highlightedMemberId: string | null;
  selectedId: string | null;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onEditFromNode: (id: string) => void;
}

export default function TreeCanvas({
  members,
  settings,
  scale,
  svgRef,
  selectedId,
  collapsedIds,
  highlightedMemberId,
  onToggleCollapse,
  onOpenDetail,
  onEditFromNode,
}: Props) {
  const theme = THEMES[settings.theme] ?? THEMES[0];
  const focus = selectedId ? getFocusPath(members, selectedId) : null;

  const { visible, positions, genMemo, childMap, width, height } = useMemo(() => {
      const visible = getVisibleMembers(members, collapsedIds);
    const positions = layoutTree(visible, settings);
    const genMemo = computeAllGens(members);
    const childMap = buildChildMap(members);
    const allX = Object.values(positions).map((p) => p.x);
    const allY = Object.values(positions).map((p) => p.y);
    const width = members.length ? Math.max(...allX) + NW + 80 : 0;
    const height = members.length ? Math.max(...allY) + NH + 80 : 0;
    return { visible, positions, genMemo, childMap, width, height };
  }, [members, settings, collapsedIds]);

  if (members.length === 0) {
    return (
      <svg
        ref={svgRef}
        id="tree-svg"
        width={0}
        height={0}
        style={{ transform: `scale(${scale})` }}
        xmlns="http://www.w3.org/2000/svg"
      />
    );
  }

  // Deux couches : éléments nets et éléments floutés (un seul filtre pour tout le groupe flouté)
  const clear: React.ReactNode[] = [];
  const dim: React.ReactNode[] = [];
  const layerFor = (isDim: boolean) => (isDim ? dim : clear);

  // Connecteurs (derrière les nœuds)
  const connectorsClear: React.ReactNode[] = [];
  const connectorsDim: React.ReactNode[] = [];

  visible.forEach((m) => {
    const pos = positions[m.id];
    if (!pos) return;

    if (m.parentId && positions[m.parentId]) {
      const pp = positions[m.parentId];
      const x1 = pp.x + NW / 2;
      const y1 = pp.y + NH;
      const x2 = pos.x + NW / 2;
      const y2 = pos.y;
      const my = (y1 + y2) / 2;
      const col = genColor(theme, genMemo[m.id] - 1);
      const isDim = !!focus && !focus.links.has(`${m.parentId}>${m.id}`);
      (isDim ? connectorsDim : connectorsClear).push(
        <path
          key={`c-${m.id}`}
          d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
          fill="none"
          stroke={col}
          strokeWidth={1.8}
          strokeOpacity={0.5}
          className="connector"
        />
      );
    }

    if (m.spouseId && positions[m.spouseId] && m.id < m.spouseId) {
      const sp = positions[m.spouseId];
      const isDim = !!focus && !(focus.nodes.has(m.id) && focus.nodes.has(m.spouseId));
      (isDim ? connectorsDim : connectorsClear).push(
        <line
          key={`s-${m.id}`}
          x1={pos.x + NW}
          y1={pos.y + NH / 2}
          x2={sp.x}
          y2={sp.y + NH / 2}
          stroke="#a89880"
          strokeWidth={1.5}
          strokeDasharray="5,4"
          strokeOpacity={0.6}
        />
      );
    }
  });

  const clipPaths: React.ReactNode[] = [];

  visible.forEach((m) => {
    const pos = positions[m.id];
    if (!pos) return;
    const g = genMemo[m.id] ?? 0;
    const col = genColor(theme, g);
    const colL = genColor(theme, g, true);
    const ini = initials(m).toUpperCase();
    const photoId = `photo-clip-${m.id}`;
    const hasPhoto = !!(m.photo && m.photo.length > 5);
    const cx = pos.x + PHOTO_R + 12;
    const cy = pos.y + NH / 2;
    const textX = pos.x + PHOTO_R * 2 + 20;
    const isDim = !!focus && !focus.nodes.has(m.id);
    const layer = layerFor(isDim);

    clipPaths.push(
      <clipPath id={photoId} key={`clip-${m.id}`}>
        <circle cx={cx} cy={cy} r={PHOTO_R} />
      </clipPath>
    );

    layer.push(
      <g
        key={m.id}
        className={`node-group${highlightedMemberId === m.id ? ' search-highlight' : ''}`}
        data-id={m.id}
        onClick={() => onOpenDetail(m.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onEditFromNode(m.id);
        }}
      >
        <rect className="node-rect" x={pos.x} y={pos.y} width={NW} height={NH} rx={NRX} fill={colL} stroke={col} strokeWidth={1.8} />
        <circle cx={cx} cy={cy} r={PHOTO_R} fill={col} opacity={0.15} />
        <circle cx={cx} cy={cy} r={PHOTO_R} fill="none" stroke={col} strokeWidth={1.5} />
        {hasPhoto ? (
          <image
            href={m.photo!}
            x={cx - PHOTO_R}
            y={cy - PHOTO_R}
            width={PHOTO_R * 2}
            height={PHOTO_R * 2}
            clipPath={`url(#${photoId})`}
            preserveAspectRatio="xMidYMid slice"
            className="node-photo"
          />
        ) : (
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={col}
            fontFamily="'Cormorant Garamond', Georgia, serif"
            fontSize={13}
            fontWeight={600}
            className="node-initials"
          >
            {ini}
          </text>
        )}
        <text
          x={textX}
          y={pos.y + NH / 2 - 9}
          fill={col}
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontSize={13.5}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          <tspan>{truncate(m.firstname, 12)}</tspan>
        </text>
        <text
          x={textX}
          y={pos.y + NH / 2 + 7}
          fill={col}
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontSize={12}
          fontWeight={400}
          style={{ pointerEvents: 'none' }}
        >
          <tspan>{truncate(m.lastname, 14)}</tspan>
        </text>
        {m.birth && (
          <text
            x={textX}
            y={pos.y + NH / 2 + 22}
            fill={col}
            opacity={0.65}
            fontFamily="'Inter', system-ui, sans-serif"
            fontSize={10}
            style={{ pointerEvents: 'none' }}
          >
            <tspan>
              {m.birth.slice(0, 4)}
              {m.death ? `–${m.death.slice(0, 4)}` : ''}
            </tspan>
          </text>
        )}
        {m.death && (
          <text x={pos.x + NW - 10} y={pos.y + 16} fill={col} opacity={0.5} fontSize={11} textAnchor="middle" style={{ pointerEvents: 'none' }}>
            †
          </text>
        )}
      </g>
    );

    // Bouton replier / déplier — hors du <g class="node-group"> : un clic ne peut donc pas ouvrir la fiche
    if ((childMap[m.id] || []).length > 0) {
      const isCollapsed = collapsedIds.has(m.id);
      const hidden = isCollapsed ? getDescendantIds(members, m.id, childMap).length : 0;
      const label = isCollapsed ? `+${hidden}` : '−';
      const bw = isCollapsed ? Math.max(26, label.length * 7 + 14) : 20;
      const bx = pos.x + NW / 2;
      const by = pos.y + NH;
      layer.push(
        <g
          key={`t-${m.id}`}
          className="collapse-btn"
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(m.id);
          }}
        >
          <title>{isCollapsed ? `Déplier (${hidden} masqué${hidden > 1 ? 's' : ''})` : 'Replier'}</title>
          <rect x={bx - bw / 2} y={by - 10} width={bw} height={20} rx={10} fill={isCollapsed ? col : '#ffffff'} stroke={col} strokeWidth={1.5} />
          <text
            x={bx}
            y={by + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isCollapsed ? '#ffffff' : col}
            fontFamily="'Inter', system-ui, sans-serif"
            fontSize={12}
            fontWeight={700}
            style={{ pointerEvents: 'none' }}
          >
            {label}
          </text>
        </g>
      );
    }
  });

  return (
    <svg
      ref={svgRef}
      id="tree-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ transform: `scale(${scale})` }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {clipPaths}
        {/* userSpaceOnUse : un trait horizontal (bbox de hauteur 0) disparaîtrait avec la région par défaut */}
        <filter id={BLUR_ID} filterUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <feGaussianBlur in="SourceGraphic" stdDeviation={4} />
        </filter>
      </defs>
      {focus && (
        <g filter={`url(#${BLUR_ID})`}>
          {connectorsDim}
          {dim}
        </g>
      )}
      {connectorsClear}
      {clear}
    </svg>
  );
}
