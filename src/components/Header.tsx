import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Printer, FileText, Share2, Settings, Download, Check, RotateCcw, Box, PenLine, HelpCircle } from 'lucide-react';
import AppLogo from './AppLogo';
import type { AircraftType } from '../utils/calculations';
import { AIRCRAFT_PRESETS } from '../utils/calculations';
import type { AircraftPreset } from '../utils/calculations';

interface HeaderProps {
  aircraftType: AircraftType;
  onPreset: (p: AircraftPreset) => void;
  viewMode: '2D' | '3D';
  onViewMode: (v: '2D' | '3D') => void;
  unit: 'cm' | 'mm';
  onUnit: (u: 'cm' | 'mm') => void;
  isDarkMode: boolean;
  onToggleDark: () => void;
  onToggleLanguage: () => void;
  onReset: () => void;
  onExportPDF: () => void;
  isExporting: boolean;
  onOpenSTL: () => void;
  onShare: () => Promise<boolean>;
  onHelp: () => void;
}

/** Closes a popover when clicking outside or pressing Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return [open, setOpen, ref] as const;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      {options.map(o => (
        <button
          key={o.v}
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${value === o.v
            ? 'bg-white dark:bg-slate-600 text-sky-700 dark:text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const menuItem = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200';

export default function Header(p: HeaderProps) {
  const { t, i18n } = useTranslation();
  const [exportOpen, setExportOpen, exportRef] = usePopover();
  const [settingsOpen, setSettingsOpen, settingsRef] = usePopover();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const ok = await p.onShare();
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2200); }
  };

  const typeIcon = (type: AircraftType) => type === 'conventional' ? (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="16" rx="2" ry="9" fill="currentColor" /><path d="M16 13 L3 18 L4 19 L16 16 L28 19 L29 18 Z" fill="currentColor" /><path d="M16 23 L10 26 L11 27 L16 25 L21 27 L22 26 Z" fill="currentColor" opacity=".7" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 10 L2 22 L6 23 L16 18 L26 23 L30 22 Z" fill="currentColor" /></svg>
  );

  return (
    <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 z-30 flex-shrink-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 sm:px-4 py-2.5">
        <AppLogo />

        <div className="order-3 w-full sm:order-2 sm:w-auto flex items-center gap-2 sm:ml-4 overflow-x-auto">
          <Segmented
            label={t('aircraft_type')}
            value={p.aircraftType}
            onChange={v => { const preset = AIRCRAFT_PRESETS.find(x => x.type === v); if (preset) p.onPreset(preset); }}
            options={AIRCRAFT_PRESETS.map(pr => ({ v: pr.type, label: <>{typeIcon(pr.type)}<span>{t(pr.labelKey)}</span></> }))}
          />
          <Segmented
            label={t('view')}
            value={p.viewMode}
            onChange={p.onViewMode}
            options={[{ v: '2D', label: <><PenLine size={14} />2D</> }, { v: '3D', label: <><Box size={14} />3D</> }]}
          />
        </div>

        <div className="order-2 sm:order-3 ml-auto flex items-center gap-1.5">
          <button onClick={p.onHelp} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800" title={t('help')} aria-label={t('help')}>
            <HelpCircle size={18} />
          </button>

          <button
            onClick={share}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            title={t('share_hint')}
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
            {copied ? t('link_copied') : t('share')}
          </button>

          {/* Export menu */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
            >
              <Download size={15} /> {p.isExporting ? t('export_loading') : t('export')}
            </button>
            {exportOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50">
                <button role="menuitem" className={menuItem} onClick={() => { setExportOpen(false); p.onOpenSTL(); }}>
                  <Printer size={16} className="text-emerald-600" />
                  <span><b className="block font-medium">{t('export_stl')}</b><span className="text-xs text-slate-500 dark:text-slate-400">{t('export_stl_desc')}</span></span>
                </button>
                <button role="menuitem" className={menuItem} onClick={() => { setExportOpen(false); p.onExportPDF(); }} disabled={p.isExporting}>
                  <FileText size={16} className="text-sky-600" />
                  <span><b className="block font-medium">{t('export_pdf')}</b><span className="text-xs text-slate-500 dark:text-slate-400">{t('export_pdf_desc')}</span></span>
                </button>
                <button role="menuitem" className={`${menuItem} sm:hidden`} onClick={() => { setExportOpen(false); void share(); }}>
                  <Share2 size={16} className="text-violet-600" />
                  <span><b className="block font-medium">{t('share')}</b><span className="text-xs text-slate-500 dark:text-slate-400">{t('share_hint')}</span></span>
                </button>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
              title={t('settings')}
              aria-label={t('settings')}
            >
              <Settings size={18} />
            </button>
            {settingsOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-60 p-3 space-y-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl z-50 text-sm">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('units')}</div>
                  <Segmented label={t('units')} value={p.unit} onChange={p.onUnit} options={[{ v: 'cm', label: 'cm' }, { v: 'mm', label: 'mm' }]} />
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('language')}</div>
                  <Segmented
                    label={t('language')}
                    value={i18n.language === 'pt' ? 'pt' : 'en'}
                    onChange={v => { if ((i18n.language === 'pt' ? 'pt' : 'en') !== v) p.onToggleLanguage(); }}
                    options={[{ v: 'pt', label: 'Português' }, { v: 'en', label: 'English' }]}
                  />
                </div>
                <button className={menuItem} onClick={p.onToggleDark}>
                  {p.isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                  {p.isDarkMode ? t('light_mode') : t('dark_mode')}
                </button>
                <button className={`${menuItem} text-red-600 dark:text-red-400`} onClick={() => { setSettingsOpen(false); p.onReset(); }}>
                  <RotateCcw size={16} /> {t('reset')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
