import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrientedSection } from '../utils/stlExport';

interface Props {
  oriented: OrientedSection[];
  /** Names of the parts left OUT of the export (empty = whole aircraft). */
  excluded: ReadonlySet<string>;
  onChange: (excluded: Set<string>) => void;
  kindLabel: (kind: string) => string;
}

const GROUP_ORDER = ['wing_R', 'wing_L', 'aileron', 'fuselage', 'hstab', 'elevator', 'fin', 'rudder', 'winglet', 'mount', 'hatch', 'joint'];
const PREFIX = /^(wing_[RL]|aileron|elevon|hstab|elevator|fin|rudder|winglet|fuselage|mount|hatch|joint)_/;

type P2 = [number, number];

/** Convex hull (monotone chain) of 2D points. */
function hull(points: P2[]): P2[] {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: P2[]) => {
    const h: P2[] = [];
    list.forEach(p => {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    });
    h.pop();
    return h;
  };
  return [...half(pts), ...half(pts.slice().reverse())];
}

const area = (h: P2[]) => Math.abs(h.reduce((a, p, i) => { const q = h[(i + 1) % h.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

/**
 * Part picker for the STL export: a top view of the aircraft where every
 * printable section can be clicked, plus the same parts grouped in a list.
 */
export default function StlPartPicker({ oriented, excluded, onChange, kindLabel }: Props) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<string | null>(null);

  // Top-view outline of every section, from its assembled geometry (X = right, Z = -station)
  const view = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const shapes = oriented.map(o => {
      const p = o.section.geometry.attributes.position;
      const pts: P2[] = [];
      for (let i = 0; i < p.count; i++) pts.push([p.getX(i), -p.getZ(i)]);
      const h = hull(pts);
      h.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
      return { name: o.section.name, d: h.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('') + 'Z', area: area(h) };
    });
    // Small parts on top, so they stay clickable over the large ones
    shapes.sort((a, b) => b.area - a.area);
    const pad = Math.max(x1 - x0, y1 - y0) * 0.03 + 2;
    return { shapes, box: `${(x0 - pad).toFixed(0)} ${(y0 - pad).toFixed(0)} ${(x1 - x0 + 2 * pad).toFixed(0)} ${(y1 - y0 + 2 * pad).toFixed(0)}`, stroke: Math.max(x1 - x0, y1 - y0) / 400 };
  }, [oriented]);

  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    oriented.forEach(o => {
      const key = o.section.kind === 'wing' ? `wing_${o.section.side === 'L' ? 'L' : 'R'}` : o.section.kind;
      m.set(key, [...(m.get(key) ?? []), o.section.name]);
    });
    return GROUP_ORDER.filter(k => m.has(k)).map(k => ({ key: k, names: m.get(k)! }));
  }, [oriented]);

  const toggle = (name: string) => {
    const next = new Set(excluded);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(next);
  };
  const setGroup = (names: string[], on: boolean) => {
    const next = new Set(excluded);
    names.forEach(n => { if (on) next.delete(n); else next.add(n); });
    onChange(next);
  };
  const groupLabel = (key: string) => (key === 'wing_R' ? t('stl_group_wing_r') : key === 'wing_L' ? t('stl_group_wing_l') : kindLabel(key));
  const link = 'underline-offset-2 hover:underline text-sky-700 dark:text-sky-300';

  const chip = (state: 'on' | 'part' | 'off') => (state === 'on'
    ? 'bg-sky-600 border-sky-600 text-white'
    : state === 'part'
      ? 'bg-sky-50 border-sky-400 text-sky-800 dark:bg-sky-900/30 dark:border-sky-600 dark:text-sky-200'
      : 'bg-transparent border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400');

  return (
    <div>
      <svg viewBox={view.box} className="w-full max-h-64 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700" role="img" aria-label={t('stl_pick')}>
        {view.shapes.map(sh => {
          const on = !excluded.has(sh.name);
          return (
            <path
              key={sh.name}
              d={sh.d}
              onClick={() => toggle(sh.name)}
              onMouseEnter={() => setHover(sh.name)}
              onMouseLeave={() => setHover(null)}
              strokeWidth={view.stroke * (hover === sh.name ? 3 : 1)}
              strokeLinejoin="round"
              className={`cursor-pointer transition-colors ${on
                ? 'fill-sky-400/60 stroke-sky-700 dark:fill-sky-500/50 dark:stroke-sky-300'
                : 'fill-slate-200/40 stroke-slate-400 dark:fill-slate-700/30 dark:stroke-slate-500'}`}
            >
              <title>{sh.name}</title>
            </path>
          );
        })}
      </svg>
      <div className="flex items-center justify-between mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span>{t('stl_pick_hint')}</span>
        <span className="flex gap-2 shrink-0">
          <button type="button" className={link} onClick={() => onChange(new Set())}>{t('stl_pick_all')}</button>
          <button type="button" className={link} onClick={() => onChange(new Set(oriented.map(o => o.section.name)))}>{t('stl_pick_none')}</button>
        </span>
      </div>

      {/* One chip per group: click to take the whole group in or out */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {groups.map(g => {
          const on = g.names.filter(n => !excluded.has(n)).length;
          const state = on === g.names.length ? 'on' : on > 0 ? 'part' : 'off';
          return (
            <button
              key={g.key}
              type="button"
              role="checkbox"
              aria-checked={state === 'on' ? true : state === 'part' ? 'mixed' : false}
              onClick={() => setGroup(g.names, state !== 'on')}
              className={`px-2 py-0.5 rounded-full border text-xs font-medium transition-colors ${chip(state)}`}
            >
              {groupLabel(g.key)}{state === 'part' ? ` ${on}/${g.names.length}` : ''}
            </button>
          );
        })}
      </div>

      <details className="mt-2 text-xs text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-semibold">{t('stl_pick_each')}</summary>
        <div className="mt-2 space-y-1.5">
          {groups.map(g => (
            <div key={g.key} className="flex flex-wrap items-center gap-1">
              <span className="w-28 shrink-0 text-slate-500 dark:text-slate-400">{groupLabel(g.key)}</span>
              {g.names.map(n => {
                const sel = !excluded.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    role="checkbox"
                    aria-checked={sel}
                    aria-label={n}
                    title={n}
                    onClick={() => toggle(n)}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(null)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono border transition-colors ${sel
                      ? 'bg-sky-100 border-sky-300 text-sky-800 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-200'
                      : 'bg-transparent border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'} ${hover === n ? 'ring-2 ring-sky-400' : ''}`}
                  >
                    {n.replace(PREFIX, '') || n}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
