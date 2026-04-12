import { useTranslation } from 'react-i18next';
import { AIRCRAFT_PRESETS } from '../utils/calculations';
import type { AircraftType, AircraftPreset } from '../utils/calculations';

interface AircraftTypeSelectorProps {
  selectedType: AircraftType;
  onSelect: (preset: AircraftPreset) => void;
}

export default function AircraftTypeSelector({ selectedType, onSelect }: AircraftTypeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
        {t('aircraft_type')}:
      </span>
      {AIRCRAFT_PRESETS.map(preset => {
        const isSelected = preset.type === selectedType;
        return (
          <button
            key={preset.type}
            onClick={() => onSelect(preset)}
            title={t(preset.descriptionKey)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full border',
              'text-sm font-medium transition-colors flex-shrink-0',
              isSelected
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500'
            ].join(' ')}
          >
            {/* Small inline icon */}
            {preset.type === 'conventional' && (
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <ellipse cx="16" cy="16" rx="2" ry="9" fill={isSelected ? 'white' : '#3b82f6'} />
                <path d="M16 13 L3 18 L4 19 L16 16 L28 19 L29 18 Z" fill={isSelected ? 'white' : '#3b82f6'} />
                <path d="M16 23 L10 26 L11 27 L16 25 L21 27 L22 26 Z" fill={isSelected ? 'rgba(255,255,255,0.7)' : '#93c5fd'} />
              </svg>
            )}
            {preset.type === 'flying_wing' && (
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M16 10 L2 22 L6 23 L16 18 L26 23 L30 22 Z" fill={isSelected ? 'white' : '#3b82f6'} />
              </svg>
            )}
            {t(preset.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
