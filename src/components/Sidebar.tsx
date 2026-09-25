import { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftDimensions, AircraftMetrics, AircraftType, AirfoilType, ControlSurfaces, FuselageType, PropellerType } from '../utils/calculations';
import { TRACTOR_PROPS, PUSHER_PROPS } from '../utils/electricSystem';
import { Plane, Fan, Wind, SlidersHorizontal, Box } from 'lucide-react';
import Section from './ui/Section';

interface SidebarProps {
  dimensions: AircraftDimensions;
  onChange: (key: keyof AircraftDimensions, value: number) => void;
  controls: ControlSurfaces;
  onControlChange: (key: keyof ControlSurfaces, value: number) => void;
  metrics: AircraftMetrics;
  unit: 'cm' | 'mm';
  aircraftType: AircraftType;
  airfoil: AirfoilType;
  onAirfoilChange: (val: AirfoilType) => void;
  fuselageStyle: FuselageType;
  onFuselageStyleChange: (val: FuselageType) => void;
  propeller: PropellerType;
  onPropellerChange: (val: PropellerType) => void;
  propCutout: boolean;
  onPropCutoutChange: (v: boolean) => void;
  teCutNeedsElevonStart: number | null;
}

// Map PropellerType keys to prop specs for the selector
const TRACTOR_KEY_MAP: { key: PropellerType; label: string; notes: string }[] = [
  { key: 'prop_6x4',   label: '6×4',    notes: TRACTOR_PROPS[0].notes },
  { key: 'prop_7x4',   label: '7×4',    notes: TRACTOR_PROPS[1].notes },
  { key: 'prop_8x4',   label: '8×4',    notes: TRACTOR_PROPS[2].notes },
  { key: 'prop_8x6',   label: '8×6',    notes: TRACTOR_PROPS[3].notes },
  { key: 'prop_9x47',  label: '9×4.7',  notes: TRACTOR_PROPS[4].notes },
  { key: 'prop_10x45', label: '10×4.5', notes: TRACTOR_PROPS[5].notes },
  { key: 'prop_10x47', label: '10×4.7', notes: TRACTOR_PROPS[6].notes },
  { key: 'prop_11x55', label: '11×5.5', notes: TRACTOR_PROPS[7].notes },
  { key: 'prop_12x6',  label: '12×6',   notes: TRACTOR_PROPS[8].notes },
  { key: 'prop_12x8',  label: '12×8',   notes: TRACTOR_PROPS[9].notes },
];

const PUSHER_KEY_MAP: { key: PropellerType; label: string; notes: string }[] = [
  { key: 'prop_7x4P',   label: '7×4P',    notes: PUSHER_PROPS[0].notes },
  { key: 'prop_8x45P',  label: '8×4.5P',  notes: PUSHER_PROPS[1].notes },
  { key: 'prop_9x47P',  label: '9×4.7P',  notes: PUSHER_PROPS[2].notes },
  { key: 'prop_10x47P', label: '10×4.7P', notes: PUSHER_PROPS[3].notes },
  { key: 'prop_10x7P',  label: '10×7P',   notes: PUSHER_PROPS[4].notes },
  { key: 'prop_11x55P', label: '11×5.5P', notes: PUSHER_PROPS[5].notes },
];

const inputClass = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unitLabel: string;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Numeric input that keeps the raw text while typing (so "1." or "" are
 * allowed mid-edit) and only reports valid, in-range numbers upward.
 */
function NumberField({ label, value, onChange, unitLabel, min = 0, max, step }: NumberFieldProps) {
  const [text, setText] = useState(String(value));

  // Sync when the value changes from outside (preset, unit toggle, reset)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(prev => (parseFloat(prev) === value ? prev : String(value)));
  }, [value]);

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step ?? 'any'}
          value={text}
          onChange={(e) => {
            const raw = e.target.value;
            setText(raw);
            const num = parseFloat(raw);
            if (!isNaN(num) && num >= min && (max === undefined || num <= max)) onChange(num);
          }}
          onBlur={() => {
            const num = parseFloat(text);
            if (isNaN(num) || text.trim() === '') {
              setText(String(value));
            } else if (clamp(num) !== num) {
              onChange(clamp(num));
              setText(String(clamp(num)));
            }
          }}
          className={inputClass}
        />
        <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 w-6">{unitLabel}</span>
      </div>
    </div>
  );
}

function DerivedInfo({ children }: { children: ReactNode }) {
  return (
    <div className="-mt-1 mb-3 px-2 py-1.5 rounded-md text-[11px] leading-snug bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300">
      {children}
    </div>
  );
}

export default function Sidebar({
  dimensions, onChange, controls, onControlChange, metrics, unit, aircraftType,
  airfoil, onAirfoilChange,
  fuselageStyle, onFuselageStyleChange,
  propeller, onPropellerChange,
  propCutout, onPropCutoutChange, teCutNeedsElevonStart,
}: SidebarProps) {
  const { t } = useTranslation();

  const renderInput = (label: string, valueKey: keyof AircraftDimensions, unitLabel?: string, min = 0, max?: number) => (
    <NumberField
      label={t(label)}
      value={dimensions[valueKey]}
      onChange={(v) => onChange(valueKey, v)}
      unitLabel={unitLabel ?? unit}
      min={min}
      max={max}
    />
  );

  const renderControl = (label: string, key: keyof ControlSurfaces, min: number, max: number) => (
    <NumberField
      label={t(label)}
      value={controls[key]}
      onChange={(v) => onControlChange(key, v)}
      unitLabel="%"
      min={min}
      max={max}
      step={1}
    />
  );

  const fmt = (n: number) => (unit === 'mm' ? n.toFixed(0) : n.toFixed(1));
  const semi = dimensions.wingspan / 2;
  const chordAt = (f: number) => dimensions.rootChord + (dimensions.tipChord - dimensions.rootChord) * f;
  const f0 = Math.min(controls.aileronStart, controls.aileronEnd) / 100;
  const f1 = Math.max(controls.aileronStart, controls.aileronEnd) / 100;
  const aileronLen = semi * (f1 - f0);
  const aileronRootC = chordAt(f0) * controls.aileronChord / 100;
  const aileronTipC = chordAt(f1) * controls.aileronChord / 100;

  const isFlyingWing = aircraftType === 'flying_wing';
  const propList = isFlyingWing ? PUSHER_KEY_MAP : TRACTOR_KEY_MAP;

  // Get notes for selected propeller
  const selectedPropInfo = propList.find(p => p.key === propeller);

  return (
    <aside className="w-full h-auto lg:h-full bg-white dark:bg-slate-900 z-20 flex flex-col overflow-y-auto border-r border-slate-200 dark:border-slate-700 transition-colors duration-200">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white">{t('sidebar_title')}</h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('sidebar_subtitle')}</p>
      </div>

      <div>
        {/* Wing Section */}
        <Section title={t('wing')} icon={<Plane size={16} />}>
          <div className="mb-3">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('airfoil_profile')}
            </label>
            <select
              value={airfoil}
              onChange={(e) => onAirfoilChange(e.target.value as AirfoilType)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="clarky">{t('airfoil_clarky')}</option>
              <option value="naca4412">{t('airfoil_naca4412')}</option>
              <option value="naca0012">{t('airfoil_naca0012')}</option>
              <option value="mh45">{t('airfoil_mh45')}</option>
            </select>
          </div>
          {renderInput('wingspan', 'wingspan')}
          <div className="flex gap-2">
            <div className="flex-1">
              {renderInput('root_chord', 'rootChord')}
            </div>
            <div className="flex-1">
              {renderInput('tip_chord', 'tipChord')}
            </div>
          </div>
          {renderInput('sweep_angle', 'sweepOffset', undefined, -1000)}
          {renderInput('dihedral', 'dihedral', '°', -10, 30)}
          {isFlyingWing && (
            <>
              {renderControl('fw_static_margin', 'fwStaticMargin', 1, 20)}
              <p className="-mt-2 mb-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('fw_static_margin_hint')}</p>
            </>
          )}
        </Section>

        {/* Propeller Section */}
        <Section title={t('propeller')} icon={<Fan size={16} />}>

          {/* Pusher/Tractor badge */}
          <div className="flex items-center gap-2 mb-2">
            {isFlyingWing ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 8l5-5 5 5M3 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
                {t('prop_pusher_badge')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border border-sky-300 dark:border-sky-700">
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13 8l-5-5-5 5M13 8l-5 5-5-5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
                {t('prop_tractor_badge')}
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isFlyingWing ? t('prop_pusher_hint') : t('prop_tractor_hint')}
            </span>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('prop_diameter_pitch')}
            </label>
            <select
              id="propeller-select"
              value={propeller}
              onChange={(e) => onPropellerChange(e.target.value as PropellerType)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {propList.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes for selected prop */}
          {selectedPropInfo && (
            <div className={`p-2 rounded-md text-xs leading-snug border ${
              isFlyingWing
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                : 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300'
            }`}>
              {selectedPropInfo.notes}
            </div>
          )}
                  {isFlyingWing && (
            <div className="mt-3">
              <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-sky-600" checked={propCutout} onChange={e => onPropCutoutChange(e.target.checked)} />
                <span><b className="font-medium">{t('te_cutout')}</b><br /><span className="text-slate-500 dark:text-slate-400">{t('te_cutout_hint')}</span></span>
              </label>
              {propCutout && teCutNeedsElevonStart !== null && (
                <div className="mt-2 p-2 rounded-md text-[11px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                  {t('te_cutout_blocked', { pct: teCutNeedsElevonStart })}
                </div>
              )}
            </div>
          )}
</Section>

        {/* Tail Section */}
        <Section title={t('tail')} icon={<Wind size={16} />}>
          {aircraftType !== 'flying_wing' && (
            <div className="flex gap-2">
              <div className="flex-1">
                {renderInput('hstab_span', 'hStabSpan')}
              </div>
              <div className="flex-1">
                {renderInput('hstab_chord', 'hStabChord')}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              {renderInput(
                aircraftType === 'flying_wing' ? 'winglet_span' : 'vstab_span',
                'vStabSpan'
              )}
            </div>
            <div className="flex-1">
              {renderInput(
                aircraftType === 'flying_wing' ? 'winglet_chord' : 'vstab_chord',
                'vStabChord'
              )}
            </div>
          </div>
        </Section>

        {/* Control Surfaces Section */}
        <Section title={t('control_surfaces_title')} icon={<SlidersHorizontal size={16} />}>
          <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            {isFlyingWing ? t('elevons') : t('ailerons')}
          </h4>
          <div className="flex gap-2">
            <div className="flex-1">{renderControl('cs_start', 'aileronStart', 0, 95)}</div>
            <div className="flex-1">{renderControl('cs_end', 'aileronEnd', 5, 100)}</div>
          </div>
          {renderControl('cs_chord', 'aileronChord', 5, 50)}
          <DerivedInfo>
            {t('cs_length')}: <b>{fmt(aileronLen)} {unit}</b> {t('cs_each')} · {t('cs_chord_short')}: <b>{fmt(aileronRootC)}→{fmt(aileronTipC)} {unit}</b>
            <br />
            {(metrics.aileronAreaRatio * 100).toFixed(1)}% {t('cs_of_wing')}
          </DerivedInfo>

          {!isFlyingWing && (
            <>
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 mt-4">{t('elevator')}</h4>
              {renderControl('cs_chord_stab', 'elevatorChord', 0, 60)}
              <DerivedInfo>
                {t('cs_length')}: <b>{fmt(dimensions.hStabSpan)} {unit}</b> · {t('cs_chord_short')}: <b>{fmt(dimensions.hStabChord * controls.elevatorChord / 100)} {unit}</b>
                <br />
                {(metrics.elevatorAreaRatio * 100).toFixed(0)}% {t('cs_of_stab')}
              </DerivedInfo>

              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 mt-4">{t('rudder')}</h4>
              {renderControl('cs_chord_fin', 'rudderChord', 0, 60)}
              <DerivedInfo>
                {t('cs_length')}: <b>{fmt(dimensions.vStabSpan)} {unit}</b> · {t('cs_chord_short')}: <b>{fmt(dimensions.vStabChord * controls.rudderChord / 100)} {unit}</b>
                <br />
                {(metrics.rudderAreaRatio * 100).toFixed(0)}% {t('cs_of_fin')}
              </DerivedInfo>
            </>
          )}
        </Section>

        {/* Fuselage Section */}
        {aircraftType !== 'flying_wing' && (
          <Section title={t('fuselage')} icon={<Box size={16} />}>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {t('fuselage_type')}
              </label>
              <select
                value={fuselageStyle}
                onChange={(e) => onFuselageStyleChange(e.target.value as FuselageType)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="trainer">{t('fuselage_trainer')}</option>
                <option value="sport">{t('fuselage_sport')}</option>
              </select>
            </div>
            {renderInput('total_length', 'fuselageLength')}
            <div className="flex gap-2">
              <div className="flex-1">{renderInput('fuselage_width', 'fuselageWidth')}</div>
              <div className="flex-1">{renderInput('fuselage_height', 'fuselageHeight')}</div>
            </div>
            {renderInput('nose_length', 'noseLength')}
            {renderInput('wing_to_tail', 'wingToTailDistance')}
          </Section>
        )}

        {aircraftType === 'flying_wing' && (
          <div className="m-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            {t('flying_wing_fuselage_note')}
          </div>
        )}
      </div>
    </aside>
  );
}
