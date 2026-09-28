/**
 * services/themes.ts
 * Reprend exactement le tableau THEMES et les fonctions de couleur de l'ancien script.js.
 */
import { ThemeDefinition } from '../types/theme';

export const THEMES: ThemeDefinition[] = [
  {
    name: 'Forêt',
    gen0: '#2d5a3d', gen0l: '#e8f2ec',
    gen1: '#2d3d6b', gen1l: '#e8ecf7',
    gen2: '#7a3b2e', gen2l: '#f5ece9',
    gen3: '#2e5568', gen3l: '#e7f0f5',
    gen4: '#5a3068', gen4l: '#f2edf5',
    accent: '#2d5a3d', swatch: '#2d5a3d',
  },
  {
    name: 'Océan',
    gen0: '#1a4a6b', gen0l: '#e3eff8',
    gen1: '#1a6b5a', gen1l: '#e3f5f0',
    gen2: '#2e4a8a', gen2l: '#e5eaf8',
    gen3: '#6b2e5a', gen3l: '#f5e5f0',
    gen4: '#2e6b4a', gen4l: '#e5f5ec',
    accent: '#1a4a6b', swatch: '#1a6b8a',
  },
  {
    name: 'Terres',
    gen0: '#6b3a1a', gen0l: '#f5ece3',
    gen1: '#5a4a1a', gen1l: '#f5f0e3',
    gen2: '#3a1a6b', gen2l: '#ece3f5',
    gen3: '#6b1a3a', gen3l: '#f5e3ec',
    gen4: '#1a6b3a', gen4l: '#e3f5ec',
    accent: '#6b3a1a', swatch: '#a05a30',
  },
  {
    name: 'Nuit',
    gen0: '#3d3d6b', gen0l: '#eeeef5',
    gen1: '#1a5a5a', gen1l: '#e3f5f5',
    gen2: '#5a1a5a', gen2l: '#f5e3f5',
    gen3: '#3d6b3d', gen3l: '#eef5ee',
    gen4: '#6b3d3d', gen4l: '#f5eeee',
    accent: '#3d3d6b', swatch: '#3d3d6b',
  },
  {
    name: 'Grenat',
    gen0: '#7a1a2e', gen0l: '#f5e3e8',
    gen1: '#2e1a7a', gen1l: '#e8e3f5',
    gen2: '#1a7a4a', gen2l: '#e3f5ec',
    gen3: '#7a5a1a', gen3l: '#f5f0e3',
    gen4: '#1a5a7a', gen4l: '#e3f0f5',
    accent: '#7a1a2e', swatch: '#a0203d',
  },
];

export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0xff) + percent));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Applique le thème choisi aux variables CSS globales (équivalent de applyTheme() dans script.js). */
export function applyThemeVars(themeIndex: number): void {
  const t = THEMES[themeIndex] ?? THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--gen0', t.gen0);
  r.setProperty('--gen0-light', t.gen0l);
  r.setProperty('--gen1', t.gen1);
  r.setProperty('--gen1-light', t.gen1l);
  r.setProperty('--gen2', t.gen2);
  r.setProperty('--gen2-light', t.gen2l);
  r.setProperty('--gen3', t.gen3);
  r.setProperty('--gen3-light', t.gen3l);
  r.setProperty('--gen4', t.gen4);
  r.setProperty('--gen4-light', t.gen4l);
  r.setProperty('--accent', t.accent);
  r.setProperty('--accent-dark', shadeColor(t.accent, -20));
  r.setProperty('--accent-bg', t.gen0l);
}
