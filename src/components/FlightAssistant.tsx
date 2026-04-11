import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { AircraftMetrics, ValidationCheck } from '../utils/calculations';

interface FlightAssistantProps {
  metrics: AircraftMetrics;
  checks: ValidationCheck[];
  unit: 'cm' | 'mm';
}

export default function FlightAssistant({ metrics, checks, unit }: FlightAssistantProps) {
  const { t } = useTranslation();

  const formatNumber = (num: number, isArea = false) => {
    return `${num.toFixed(1)} ${unit}${isArea ? '²' : ''}`;
  };

  const hasUnstable = checks.some(c => c.level === 'unstable');
  const hasWarning = checks.some(c => c.level === 'warning');

  let overallStatusColor = 'text-green-600 bg-green-50 border-green-200';
  let overallStatusText = 'status_stable';
  let StatusIcon = CheckCircle2;

  if (hasUnstable) {
    overallStatusColor = 'text-red-600 bg-red-50 border-red-200';
    overallStatusText = 'status_unstable';
    StatusIcon = AlertTriangle;
  } else if (hasWarning) {
    overallStatusColor = 'text-yellow-600 bg-yellow-50 border-yellow-200';
    overallStatusText = 'status_warning';
    StatusIcon = AlertTriangle;
  }

  return (
    <aside className="w-80 bg-white shadow-l z-20 flex flex-col h-full border-l border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t('flight_assistant')}</h2>
        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${overallStatusColor}`}>
          <StatusIcon size={14} />
          {t(overallStatusText)}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Metrics Section */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
            Metrics
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-gray-600">{t('mac')}:</span>
              <span className="font-medium">{formatNumber(metrics.mac)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">{t('cg_position')}:</span>
              <span className="font-medium">{formatNumber(metrics.cgPosition)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">{t('aspect_ratio')}:</span>
              <span className="font-medium">{metrics.aspectRatio.toFixed(2)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">{t('tail_moment_arm')}:</span>
              <span className="font-medium">{formatNumber(metrics.tailMomentArm)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">{t('hstab_area')}:</span>
              <span className="font-medium">{formatNumber(metrics.hStabArea, true)}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-gray-600">{t('vstab_area')}:</span>
              <span className="font-medium">{formatNumber(metrics.vStabArea, true)}</span>
            </li>
          </ul>
        </div>

        {/* Warnings Section */}
        {checks.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
              Analysis
            </h3>
            <div className="space-y-3">
              {checks.map(check => (
                <div
                  key={check.id}
                  className={`p-3 rounded border text-sm ${
                    check.level === 'unstable'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  }`}
                >
                  <div className="flex gap-2">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <p>{t(check.messageKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guidelines Section */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 pb-1 border-b border-gray-200">
            {t('control_surfaces')}
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800 space-y-2">
            <div className="flex gap-2">
              <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
              <p>{t('ailerons_rec')}</p>
            </div>
            <div className="flex gap-2">
              <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
              <p>{t('elevator_rec')}</p>
            </div>
            <div className="flex gap-2">
              <Info size={16} className="shrink-0 mt-0.5 text-blue-500" />
              <p>{t('rudder_rec')}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
