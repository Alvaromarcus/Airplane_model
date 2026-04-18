import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { AircraftMetrics, ValidationCheck, AircraftType } from '../utils/calculations';
import PerformanceChart from './PerformanceChart';

interface FlightAssistantProps {
  metrics: AircraftMetrics;
  checks: ValidationCheck[];
  unit: 'cm' | 'mm';
  isDarkMode: boolean;
  aircraftType: AircraftType;
}

import { useState } from 'react';

export default function FlightAssistant({ metrics, checks, unit, isDarkMode, aircraftType }: FlightAssistantProps) {
  const { t } = useTranslation();
  const [openFixId, setOpenFixId] = useState<string | null>(null);

  const formatNumber = (num: number, isArea = false) => {
    return `${num.toFixed(1)} ${unit}${isArea ? '²' : ''}`;
  };

  const hasUnstable = checks.some(c => c.level === 'unstable');
  const hasWarning = checks.some(c => c.level === 'warning');

  let overallStatusColor = 'text-green-600 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
  let overallStatusText = 'status_stable';
  let StatusIcon = CheckCircle2;

  if (hasUnstable) {
    overallStatusColor = 'text-red-600 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
    overallStatusText = 'status_unstable';
    StatusIcon = AlertTriangle;
  } else if (hasWarning) {
    overallStatusColor = 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800';
    overallStatusText = 'status_warning';
    StatusIcon = AlertTriangle;
  }

  const wingAreaCm2 = unit === 'mm' ? metrics.wingArea / 100 : metrics.wingArea;
  const aileronArea = metrics.wingArea * 0.12;
  const elevatorArea = metrics.hStabArea * 0.25;
  const rudderArea = metrics.vStabArea * 0.25;
  
  const auwGrams = wingAreaCm2 * 0.45; 
  const powerWatts = (auwGrams / 453.6) * 100;
  const kv = 1000;
  const lipoCells = '3S';
  const recProp = '9x6 - 10x5';

  return (
    <aside className="w-full lg:w-80 bg-white dark:bg-gray-800 shadow-md z-20 flex flex-col h-auto lg:h-full border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 overflow-y-auto transition-colors duration-200">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{t('flight_assistant')}</h2>
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${overallStatusColor}`}>
          <StatusIcon size={14} />
          {t(overallStatusText)}
        </div>
      </div>

      <div className="p-4 space-y-6 text-gray-800 dark:text-gray-200">
        {/* Metrics Section */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
            {t('metrics')}
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('wing_area')}:</span>
              <span className="font-medium">{formatNumber(metrics.wingArea, true)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('half_wing_area')}:</span>
              <span className="font-medium">{formatNumber(metrics.halfWingArea, true)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('mac')}:</span>
              <span className="font-medium">{formatNumber(metrics.mac)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('cg_position')}:</span>
              <span className="font-medium">{formatNumber(metrics.cgPosition)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('neutral_point')}:</span>
              <span className="font-medium">{formatNumber(metrics.neutralPoint)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('static_margin')}:</span>
              <span className="font-medium">{metrics.staticMargin.toFixed(1)}%</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('aspect_ratio')}:</span>
              <span className="font-medium">{metrics.aspectRatio.toFixed(2)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('tail_moment_arm')}:</span>
              <span className="font-medium">{formatNumber(metrics.tailMomentArm)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('hstab_area')}:</span>
              <span className="font-medium">{formatNumber(metrics.hStabArea, true)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{t('vstab_area')}:</span>
              <span className="font-medium">{formatNumber(metrics.vStabArea, true)}</span>
            </li>
          </ul>
        </div>

        {/* Performance Chart Section */}
        <div className="mb-6">
          <PerformanceChart metrics={metrics} unit={unit} isDarkMode={isDarkMode} aircraftType={aircraftType} />
        </div>

        {/* Warnings Section */}
        {checks.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
              {t('analysis')}
            </h3>
            <div className="space-y-3">
              {checks.map(check => (
                <div
                  key={check.id}
                  className={`p-3 rounded border text-sm ${
                    check.level === 'unstable'
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                      : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300'
                  }`}
                >
                  <div className="flex gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col w-full">
                      <p>{t(check.messageKey)}</p>
                      {check.fixKey && (
                        <>
                          <div
                            className="text-xs underline opacity-70 hover:opacity-100 mt-1 cursor-pointer flex items-center gap-1"
                            onClick={() => setOpenFixId(openFixId === check.id ? null : check.id)}
                          >
                            {openFixId === check.id ? t('hide_fix') : t('how_to_fix')}
                          </div>
                          {openFixId === check.id && (
                            <div className="mt-2 pt-2 border-t border-current opacity-70 text-xs leading-relaxed">
                              {t(check.fixKey)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Components & Specs Section */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
            {t('components_specs')}
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm text-blue-800 dark:text-blue-300">
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span className="opacity-80">{t('aileron_area')}:</span>
                <span className="font-semibold">{formatNumber(aileronArea, true)}</span>
              </li>
              {aircraftType === 'conventional' && (
                <>
                  <li className="flex justify-between">
                    <span className="opacity-80">{t('elevator_area')}:</span>
                    <span className="font-semibold">{formatNumber(elevatorArea, true)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="opacity-80">{t('rudder_area')}:</span>
                    <span className="font-semibold">{formatNumber(rudderArea, true)}</span>
                  </li>
                </>
              )}
              <li className="flex justify-between mt-2 pt-2 border-t border-blue-200 dark:border-blue-800/50">
                <span className="opacity-80">{t('est_auw')}:</span>
                <span className="font-semibold">{auwGrams.toFixed(0)} g</span>
              </li>
              <li className="flex justify-between">
                <span className="opacity-80">{t('req_power')}:</span>
                <span className="font-semibold">{powerWatts.toFixed(0)} W</span>
              </li>
              <li className="flex justify-between">
                <span className="opacity-80">{t('motor_kv')}:</span>
                <span className="font-semibold">~{kv} Kv</span>
              </li>
              <li className="flex justify-between">
                <span className="opacity-80">{t('lipo_cells')}:</span>
                <span className="font-semibold">{lipoCells}</span>
              </li>
              <li className="flex justify-between">
                <span className="opacity-80">{t('rec_prop')}:</span>
                <span className="font-semibold">{recProp}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </aside>
  );
}
