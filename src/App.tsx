import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import Sidebar from './components/Sidebar';
import FlightAssistant from './components/FlightAssistant';
import CanvasView from './components/CanvasView';
import { calculateMetrics, validateDesign } from './utils/calculations';
import type { AircraftDimensions } from './utils/calculations';
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
  const [dimensions, setDimensions] = useState<AircraftDimensions>(defaultDimensions);
  const [unit, setUnit] = useState<'cm' | 'mm'>('cm');
  const [isExporting, setIsExporting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

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
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF(dimensions, unit);
    } catch (error) {
      console.error("PDF Export failed", error);
    }
    setIsExporting(false);
  };

  const metrics = useMemo(() => calculateMetrics(dimensions), [dimensions]);
  const validationChecks = useMemo(() => validateDesign(dimensions, metrics), [dimensions, metrics]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden font-sans transition-colors duration-200">
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
        dimensions={dimensions}
        onChange={handleDimensionChange}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white dark:bg-gray-800 shadow-sm z-10 flex justify-between items-center p-4 transition-colors duration-200">
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
              onClick={handleExportPDF}
              disabled={isExporting}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors text-sm font-medium flex items-center gap-2"
            >
              {isExporting ? t('export_loading') : t('export_pdf')}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 relative bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <CanvasView dimensions={dimensions} metrics={metrics} isDarkMode={isDarkMode} />
          </div>

          <FlightAssistant
            metrics={metrics}
            checks={validationChecks}
            unit={unit}
          />
        </div>
      </main>
      </div>
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-2 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200 z-20">
        {t('developed_by')} <a href="https://www.linkedin.com/in/alvaromarcus/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Alvaro Marcus</a>
      </footer>
    </div>
  );
}

export default App;
