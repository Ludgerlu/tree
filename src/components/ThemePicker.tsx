import React from 'react';
import { THEMES } from '../services/themes';

interface Props {
  value: number;
  onChange: (i: number) => void;
}

export default function ThemePicker({ value, onChange }: Props) {
  return (
    <div className="theme-swatches">
      {THEMES.map((t, i) => (
        <div
          key={t.name}
          className={`theme-swatch${i === value ? ' active' : ''}`}
          style={{ background: t.swatch }}
          title={t.name}
          onClick={() => onChange(i)}
        />
      ))}
    </div>
  );
}
