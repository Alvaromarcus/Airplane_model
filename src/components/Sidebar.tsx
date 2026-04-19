import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftDimensions, AircraftType, AirfoilType } from '../utils/calculations';

interface SidebarProps {
  dimensions: AircraftDimensions;
  onChange: (key: keyof AircraftDimensions, value: number) => void;
  unit: 'cm' | 'mm';
  aircraftType: AircraftType;
  airfoil: AirfoilType;
  onAirfoilChange: (val: AirfoilType) => void;
}

export default function Sidebar({ dimensions, onChange, unit, aircraftType, airfoil, onAirfoilChange }: SidebarProps) {
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
              <option value="flat">{t('airfoil_flat')}</option>
              <option value="semi">{t('airfoil_semi')}</option>
              <option value="sym">{t('airfoil_sym')}</option>
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
