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
    <div className="flex flex-row md:flex-wrap gap-4 items-center">
      {AIRCRAFT_PRESETS.map((preset) => {
        const isSelected = preset.type === selectedType;
        const baseClasses = "cursor-pointer rounded-xl border-2 p-3 flex flex-col gap-1 transition-colors border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 w-36 flex-shrink-0";
        const selectedClasses = "border-blue-500 bg-blue-50 dark:bg-blue-900/30";
        const className = `${baseClasses} ${isSelected ? selectedClasses : ''}`;

        return (
          <div key={preset.type} className={className} onClick={() => onSelect(preset)}>
            <div className="h-8 w-8 mb-2 flex items-center justify-center text-gray-500 dark:text-gray-400">
              {preset.type === 'conventional' && (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="10" width="16" height="4" rx="1" />
                  <path d="M12 2L10 10H14L12 2Z" />
                  <path d="M12 22L9 18H15L12 22Z" />
                </svg>
              )}
              {preset.type === 'flying_wing' && (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4L22 20H2L12 4Z" />
                </svg>
              )}
            </div>
            <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">
              {t(preset.labelKey)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {t(preset.descriptionKey)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
