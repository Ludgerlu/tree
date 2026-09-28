import React from 'react';

interface Props {
  memberCount: number;
}

export default function LegendBar({ memberCount }: Props) {
  return (
    <div id="legend-bar">
      {[0, 1, 2, 3, 4].map((g) => (
        <div className="legend-item" key={g}>
          <span className="leg-swatch" data-gen={g}></span> G-{g + 1}
        </div>
      ))}
      <div className="legend-sep"></div>
      <div className="legend-item">
        <span className="leg-gender m"></span> H
      </div>
      <div className="legend-item">
        <span className="leg-gender f"></span> F
      </div>
      <div className="legend-item" id="member-count">
        {memberCount} membre{memberCount > 1 ? 's' : ''}
      </div>
    </div>
  );
}
