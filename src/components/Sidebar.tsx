import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftDimensions, AircraftType, AirfoilType, FuselageType, PropellerType } from '../utils/calculations';
import { TRACTOR_PROPS, PUSHER_PROPS } from '../utils/electricSystem';

interface SidebarProps {
  dimensions: AircraftDimensions;
  onChange: (key: keyof AircraftDimensions, value: number) => void;
  unit: 'cm' | 'mm';
  aircraftType: AircraftType;
  airfoil: AirfoilType;
  onAirfoilChange: (val: AirfoilType) => void;
  fuselageStyle: FuselageType;
  onFuselageStyleChange: (val: FuselageType) => void;
  propeller: PropellerType;
  onPropellerChange: (val: PropellerType) => void;
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

export default function Sidebar({
  dimensions, onChange, unit, aircraftType,
  airfoil, onAirfoilChange,
  fuselageStyle, onFuselageStyleChange,
  propeller, onPropellerChange,
}: SidebarProps) {
  const { t } = useTranslation();

  const [localValues, setLocalValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    (Object.keys(dimensions) as (keyof AircraftDimensions)[]).forEach(k => {
      init[k] = String(dimensions[k]);
    });
    return init;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalValues(prev => {
      const next = { ...prev };
      (Object.keys(dimensions) as (keyof AircraftDimensions)[]).forEach(k => {
        const parsed = parseFloat(prev[k]);
        if (!isNaN(parsed) && parsed !== dimensions[k]) {
          next[k] = String(dimensions[k]);
        }
        if (isNaN(parsed)) {
          next[k] = prev[k];
        }
      });
      return next;
    });
  }, [dimensions]);

  const renderInput = (label: string, valueKey: keyof AircraftDimensions, unitLabel?: string) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {t(label)}
      </label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={localValues[valueKey] ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            setLocalValues(prev => ({ ...prev, [valueKey]: raw }));
            const num = parseFloat(raw);
            if (!isNaN(num)) {
              onChange(valueKey, num);
            }
          }}
          onBlur={() => {
            const raw = localValues[valueKey];
            const num = parseFloat(raw);
            if (isNaN(num) || raw.trim() === '') {
              setLocalValues(prev => ({ ...prev, [valueKey]: String(dimensions[valueKey]) }));
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 w-6">
          {unitLabel ?? unit}
        </span>
      </div>
    </div>
  );

  const isFlyingWing = aircraftType === 'flying_wing';
  const propList = isFlyingWing ? PUSHER_KEY_MAP : TRACTOR_KEY_MAP;

  // Get notes for selected propeller
  const selectedPropInfo = propList.find(p => p.key === propeller);

  return (
    <aside className="w-full h-auto lg:h-full bg-white dark:bg-gray-800 shadow-md z-20 flex flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{t('sidebar_title')}</h2>
      </div>

      <div className="p-4">
        {/* Wing Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
            {t('wing')}
          </h3>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('airfoil_profile')}
            </label>
            <select
              value={airfoil}
              onChange={(e) => onAirfoilChange(e.target.value as AirfoilType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
          {renderInput('sweep_angle', 'sweepOffset')}
          {renderInput('dihedral', 'dihedral', '°')}
        </div>

        {/* Propeller Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
            {t('propeller')}
          </h3>

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
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isFlyingWing ? t('prop_pusher_hint') : t('prop_tractor_hint')}
            </span>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('prop_diameter_pitch')}
            </label>
            <select
              id="propeller-select"
              value={propeller}
              onChange={(e) => onPropellerChange(e.target.value as PropellerType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
        </div>

        {/* Tail Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
            {t('tail')}
          </h3>
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
        </div>

        {/* Fuselage Section */}
        {aircraftType !== 'flying_wing' && (
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
              {t('fuselage')}
            </h3>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fuselage_type')}
              </label>
              <select
                value={fuselageStyle}
                onChange={(e) => onFuselageStyleChange(e.target.value as FuselageType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="trainer">{t('fuselage_trainer')}</option>
                <option value="sport">{t('fuselage_sport')}</option>
              </select>
            </div>
            {renderInput('total_length', 'fuselageLength')}
            {renderInput('nose_length', 'noseLength')}
            {renderInput('wing_to_tail', 'wingToTailDistance')}
          </div>
        )}

        {aircraftType === 'flying_wing' && (
          <div className="mb-6 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
            {t('flying_wing_fuselage_note')}
          </div>
        )}
      </div>
    </aside>
  );
}
