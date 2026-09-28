/**
 * components/TreeCanvas.tsx
 * Rendu SVG de l'arbre — reprend renderTree() de l'ancien script.js
 * (connecteurs parent→enfant, lien conjoint, nœuds avec photo/initiales).
 */
import React, { useMemo } from 'react';
import { Member, Settings } from '../types';
import { THEMES } from '../services/themes';
import { computeAllGens, genColor, initials, layoutTree, truncate } from '../services/treeLayout';

const NW = 158;
const NH = 80;
const NRX = 12;
const PHOTO_R = 22;

interface Props {
  members: Member[];
  settings: Settings;
  scale: number;
  svgRef: React.RefObject<SVGSVGElement>;
  highlightedMemberId: string | null;
  onOpenDetail: (id: string) => void;
  onEditFromNode: (id: string) => void;
}

export default function TreeCanvas({ members, settings, scale, svgRef, highlightedMemberId, onOpenDetail, onEditFromNode }: Props) {
  const theme = THEMES[settings.theme] ?? THEMES[0];

  const { positions, genMemo, width, height } = useMemo(() => {
    const positions = layoutTree(members, settings);
    const genMemo = computeAllGens(members);
    const allX = Object.values(positions).map((p) => p.x);
    const allY = Object.values(positions).map((p) => p.y);
    const width = members.length ? Math.max(...allX) + NW + 80 : 0;
    const height = members.length ? Math.max(...allY) + NH + 80 : 0;
    return { positions, genMemo, width, height };
  }, [members, settings]);

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

  const connectors: React.ReactNode[] = [];
  const nodes: React.ReactNode[] = [];
  const clipPaths: React.ReactNode[] = [];

  members.forEach((m) => {
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
      connectors.push(
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
      const x1 = pos.x + NW;
      const y1 = pos.y + NH / 2;
      const x2 = sp.x;
      const y2 = sp.y + NH / 2;
      connectors.push(
        <line
          key={`s-${m.id}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#a89880"
          strokeWidth={1.5}
          strokeDasharray="5,4"
          strokeOpacity={0.6}
        />
      );
    }
  });

  members.forEach((m) => {
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

    clipPaths.push(
      <clipPath id={photoId} key={`clip-${m.id}`}>
        <circle cx={cx} cy={cy} r={PHOTO_R} />
      </clipPath>
    );

    nodes.push(
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
      <defs>{clipPaths}</defs>
      {connectors}
      {nodes}
    </svg>
  );
}
