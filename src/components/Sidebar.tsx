import { useTranslation } from 'react-i18next';
import type { AircraftDimensions } from '../utils/calculations';

interface SidebarProps {
  dimensions: AircraftDimensions;
  onChange: (key: keyof AircraftDimensions, value: number) => void;
}

export default function Sidebar({ dimensions, onChange }: SidebarProps) {
  const { t } = useTranslation();

  const handleInputChange = (key: keyof AircraftDimensions, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onChange(key, num);
    }
  };

  const renderInput = (label: string, valueKey: keyof AircraftDimensions) => (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-700 mb-1">{t(label)}</label>
      <input
        type="number"
        value={dimensions[valueKey]}
        onChange={(e) => handleInputChange(valueKey, e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>
  );

  return (
    <aside className="w-80 bg-white shadow-md z-20 flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800">{t('app_title')} Parameters</h2>
      </div>

      <div className="p-4">
        {/* Wing Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
            {t('wing')}
          </h3>
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
        </div>

        {/* Tail Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
            {t('tail')}
          </h3>
          <div className="flex gap-2">
            <div className="flex-1">
              {renderInput('hstab_span', 'hStabSpan')}
            </div>
            <div className="flex-1">
              {renderInput('hstab_chord', 'hStabChord')}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              {renderInput('vstab_span', 'vStabSpan')}
            </div>
            <div className="flex-1">
              {renderInput('vstab_chord', 'vStabChord')}
            </div>
          </div>
        </div>

        {/* Fuselage Section */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
            {t('fuselage')}
          </h3>
          {renderInput('total_length', 'fuselageLength')}
          {renderInput('nose_length', 'noseLength')}
          {renderInput('wing_to_tail', 'wingToTailDistance')}
        </div>
      </div>
    </aside>
  );
}
