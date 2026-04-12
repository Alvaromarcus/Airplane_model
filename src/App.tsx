import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import Sidebar from './components/Sidebar';
import FlightAssistant from './components/FlightAssistant';
import CanvasView from './components/CanvasView';
import AircraftTypeSelector from './components/AircraftTypeSelector';
import { calculateMetrics, validateDesign } from './utils/calculations';
import type { AircraftDimensions, AircraftType, AircraftPreset } from './utils/calculations';
import { exportToPDF } from './utils/pdfExport';
import './App.css';

const defaultDimensions: AircraftDimensions = {
  wingspan: 100,
  rootChord: 20,
  tipChord: 15,
  sweepOffset: 5,
  dihedral: 5,
  hStabSpan: 32,
  hStabChord: 9,
  vStabSpan: 15,
  vStabChord: 10,
  fuselageLength: 80,
  noseLength: 15,
  wingToTailDistance: 32,
};

function App() {
  const { t, i18n } = useTranslation();

  // Initialize state from localStorage or fallback to defaults
  const [dimensions, setDimensions] = useState<AircraftDimensions>(() => {
    const saved = localStorage.getItem('aerobuilder_dims');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved dimensions', e);
      }
    }
    return defaultDimensions;
  });

  const [unit, setUnit] = useState<'cm' | 'mm'>('cm');
  const [aircraftType, setAircraftType] = useState<AircraftType>('conventional');
  const [isExporting, setIsExporting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Persist dimensions whenever they change
  useEffect(() => {
    localStorage.setItem('aerobuilder_dims', JSON.stringify(dimensions));
  }, [dimensions]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleUnitToggle = (newUnit: 'cm' | 'mm') => {
    if (unit === newUnit) return;

    const multiplier = newUnit === 'mm' ? 10 : 0.1;

    setDimensions(prev => {
      const newDims = { ...prev };
      // Multiply all dimensions by the multiplier, except for dihedral which is in degrees
      (Object.keys(newDims) as (keyof AircraftDimensions)[]).forEach(key => {
        if (key !== 'dihedral') {
          newDims[key] = parseFloat((newDims[key] * multiplier).toFixed(2));
        }
      });
      return newDims;
    });

    setUnit(newUnit);
  };

  const handleDimensionChange = (key: keyof AircraftDimensions, value: number) => {
    setDimensions(prev => ({ ...prev, [key]: value }));
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'pt' : 'en';
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang === 'pt' ? 'pt-BR' : 'en-US';
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF(dimensions, metrics, validationChecks, unit, i18n.language, t);
    } catch (error) {
      console.error("PDF Export failed", error);
    }
    setIsExporting(false);
  };

  const handleReset = () => {
    localStorage.removeItem('aerobuilder_dims');
    setDimensions(defaultDimensions);
    setUnit('cm');
    setAircraftType('conventional');
  };

  const handlePresetSelect = (preset: AircraftPreset) => {
    setAircraftType(preset.type);
    setDimensions(preset.defaults);
  };

  const metrics = calculateMetrics(dimensions, aircraftType);
  const validationChecks = validateDesign(dimensions, metrics);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden font-sans transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm z-10 flex flex-wrap gap-2 justify-between items-center p-4 transition-colors duration-200 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">{t('app_title')}</h1>

        <div className="flex gap-4 items-center">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title={isDarkMode ? t('light_mode') : t('dark_mode')}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-600 dark:text-gray-300">{t('units')}:</span>
            <select
              value={unit}
              onChange={(e) => handleUnitToggle(e.target.value as 'cm' | 'mm')}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            >
              <option value="cm">{t('cm')}</option>
              <option value="mm">{t('mm')}</option>
            </select>
          </div>

          <button
            onClick={toggleLanguage}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-3 py-1 rounded transition-colors text-sm font-medium"
          >
            {i18n.language === 'en' ? 'PT-BR' : 'EN'}
          </button>

            <button
              onClick={handleReset}
              className="bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 px-3 py-1 rounded transition-colors text-sm font-medium border border-red-200 dark:border-red-800"
            >
              {t('reset')}
            </button>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors text-sm font-medium flex items-center gap-2"
          >
            {isExporting ? t('export_loading') : t('export_pdf')}
          </button>
        </div>
      </header>

      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2 overflow-x-auto flex-shrink-0">
        <AircraftTypeSelector selectedType={aircraftType} onSelect={handlePresetSelect} />
      </div>

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
        <div className="order-3 lg:order-1 w-full lg:w-64 flex-shrink-0 z-10">
          <Sidebar
            dimensions={dimensions}
            onChange={handleDimensionChange}
            unit={unit}
          />
        </div>

        <div className="order-1 lg:order-2 w-full lg:flex-1 relative min-h-[400px] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-x-auto">
          <CanvasView dimensions={dimensions} metrics={metrics} isDarkMode={isDarkMode} />
        </div>

        <div className="order-2 lg:order-3 w-full lg:w-80 flex-shrink-0">
          <FlightAssistant
            metrics={metrics}
            checks={validationChecks}
            unit={unit}
          />
        </div>
      </main>
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-2 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200 z-20">
        {t('developed_by')} <a href="https://www.linkedin.com/in/alvaromarcus/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Alvaro Marcus</a>
      </footer>
    </div>
  );
}

export default App;
