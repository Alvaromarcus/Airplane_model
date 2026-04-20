import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Wind, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { recommendMotorAndProp } from '../utils/electricSystem';
import type { PowerCategory } from '../utils/electricSystem';
import type { AircraftDimensions, AircraftType } from '../utils/calculations';

interface ElectricSystemAdvisorProps {
  dimensions: AircraftDimensions;
  aircraftType: AircraftType;
  unit: 'cm' | 'mm';
}

const CATEGORY_LABELS: Record<PowerCategory, { pt: string; en: string; desc_pt: string; desc_en: string }> = {
  trainer: {
    pt: 'Treinador',
    en: 'Trainer',
    desc_pt: '~100 W/kg · voo suave',
    desc_en: '~100 W/kg · relaxed flight',
  },
  sport: {
    pt: 'Esporte',
    en: 'Sport',
    desc_pt: '~200 W/kg · ágil',
    desc_en: '~200 W/kg · agile',
  },
  aerobatic: {
    pt: 'Aerobático',
    en: 'Aerobatic',
    desc_pt: '~300 W/kg · 3D',
    desc_en: '~300 W/kg · 3D',
  },
};

export default function ElectricSystemAdvisor({ dimensions, aircraftType, unit }: ElectricSystemAdvisorProps) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'pt' ? 'pt' : 'en';

  const [powerCategory, setPowerCategory] = useState<PowerCategory>('trainer');
  const [notesOpen, setNotesOpen] = useState(false);

  const rec = recommendMotorAndProp(dimensions, aircraftType, powerCategory, unit);

  const cellColor = rec.batteryCell === 2
    ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30 border-green-200 dark:border-green-800'
    : rec.batteryCell === 3
    ? 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
    : 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800';

  const powerOk = rec.powerRequired_W <= rec.motor.maxPower_W;

  return (
    <div className="p-4 space-y-4 text-gray-800 dark:text-gray-200">

      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-700">
        <Zap size={16} className="text-amber-500" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          {lang === 'pt' ? 'Sistema Elétrico — Motor & Hélice' : 'Electric System — Motor & Propeller'}
        </h3>
      </div>

      {/* Category selector */}
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {lang === 'pt' ? 'Categoria de voo' : 'Flight category'}
        </p>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(CATEGORY_LABELS) as PowerCategory[]).map(cat => {
            const label = CATEGORY_LABELS[cat];
            const isActive = powerCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setPowerCategory(cat)}
                className={[
                  'flex-1 min-w-[90px] px-2 py-2 rounded border text-xs font-medium transition-colors text-center',
                  isActive
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-amber-400',
                ].join(' ')}
              >
                <div className="font-semibold">{lang === 'pt' ? label.pt : label.en}</div>
                <div className={`mt-0.5 ${isActive ? 'text-amber-100' : 'text-gray-400 dark:text-gray-500'}`}>
                  {lang === 'pt' ? label.desc_pt : label.desc_en}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AUW estimate */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded border border-gray-200 dark:border-gray-700 p-2">
          <p className="text-gray-500 dark:text-gray-400">
            {lang === 'pt' ? 'Peso estimado (AUW)' : 'Estimated weight (AUW)'}
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
            {rec.estimatedAUW_g} g
          </p>
          <p className="text-gray-400 mt-0.5">{rec.wingLoading_g_dm2} g/dm²</p>
        </div>
        <div className={`rounded border p-2 ${powerOk
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <p className={`${powerOk ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {lang === 'pt' ? 'Potência necessária' : 'Power required'}
          </p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
            {rec.powerRequired_W} W
          </p>
          <p className="text-gray-400 mt-0.5">{rec.powerLoading_W_kg} W/kg</p>
        </div>
      </div>

      {/* Motor card */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap size={14} className="text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400 tracking-wider">
            {lang === 'pt' ? 'Motor Brushless' : 'Brushless Motor'}
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {rec.motor.size}
          </span>
          <span className="text-base font-semibold text-amber-700 dark:text-amber-300">
            {rec.motor.kv} KV
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <div>
            <p className="text-gray-500 dark:text-gray-400">{lang === 'pt' ? 'Potência máx' : 'Max power'}</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100">{rec.motor.maxPower_W} W</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">{lang === 'pt' ? 'Corrente máx' : 'Max current'}</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100">{rec.motor.maxCurrent_A} A</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">{lang === 'pt' ? 'Peso' : 'Weight'}</p>
            <p className="font-semibold text-gray-800 dark:text-gray-100">{rec.motor.weight_g} g</p>
          </div>
        </div>

        <div className="text-xs mb-2">
          <p className="text-gray-500 dark:text-gray-400 mb-0.5">
            {lang === 'pt' ? 'Padrão de furos' : 'Mount pattern'}
          </p>
          <span className="font-mono bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded text-xs">
            {rec.motor.mountPattern_mm} mm
          </span>
        </div>

        <div className="text-xs">
          <p className="text-gray-500 dark:text-gray-400 mb-1">
            {lang === 'pt' ? 'Exemplos compatíveis' : 'Compatible examples'}
          </p>
          <div className="space-y-0.5">
            {rec.motor.examples.map(ex => (
              <p key={ex} className="text-gray-700 dark:text-gray-300">• {ex}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Propeller card */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Wind size={14} className="text-blue-600 dark:text-blue-400" />
          <span className="text-xs font-bold uppercase text-blue-700 dark:text-blue-400 tracking-wider">
            {lang === 'pt' ? 'Hélice' : 'Propeller'}
            <span className="ml-1 normal-case font-normal">
              ({rec.prop.type === 'pusher'
                ? (lang === 'pt' ? 'empurradora' : 'pusher')
                : (lang === 'pt' ? 'tratora' : 'puller')})
            </span>
          </span>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{rec.prop.label}</span>
          <span className="text-sm text-blue-600 dark:text-blue-300">
            {lang === 'pt' ? 'pol' : 'inch'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-gray-500 dark:text-gray-400">{lang === 'pt' ? 'Diâmetro' : 'Diameter'}</p>
            <p className="font-semibold">{rec.prop.diameter_inch}"</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">{lang === 'pt' ? 'Passo' : 'Pitch'}</p>
            <p className="font-semibold">{rec.prop.pitch_inch}"</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{rec.prop.notes}</p>
      </div>

      {/* ESC + Battery cell */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-xs">
          <p className="text-gray-500 dark:text-gray-400 mb-1">ESC mínimo</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{rec.esc_A} A</p>
          <p className="text-gray-400 mt-0.5">
            {lang === 'pt' ? '+ 25% margem segurança' : '+ 25% safety margin'}
          </p>
        </div>
        <div className={`rounded border p-2.5 text-xs ${cellColor}`}>
          <p className="mb-1 opacity-70">
            {lang === 'pt' ? 'Bateria recomendada' : 'Recommended battery'}
          </p>
          <p className="text-xl font-bold">{rec.batteryCell}S LiPo</p>
          <p className="mt-0.5 opacity-70">
            {rec.batteryCell * 3.7} V nominal
          </p>
        </div>
      </div>

      {/* Notes collapsible */}
      {rec.notes.length > 0 && (
        <div className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={() => setNotesOpen(o => !o)}
          >
            <span className="flex items-center gap-1.5">
              <Info size={13} />
              {lang === 'pt' ? 'Observações técnicas' : 'Technical notes'}
            </span>
            {notesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {notesOpen && (
            <div className="px-3 py-2 space-y-1.5 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
              {rec.notes.map((note, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  • {note}
                </p>
              ))}
            </div>
          )}
        </div>
      )}


    </div>
  );
}
