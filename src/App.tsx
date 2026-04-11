import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  hStabSpan: 30,
  hStabChord: 8,
  vStabSpan: 15,
  vStabChord: 10,
  fuselageLength: 80,
  noseLength: 15,
  wingToTailDistance: 35,
};

function App() {
  const { t, i18n } = useTranslation();
  const [dimensions, setDimensions] = useState<AircraftDimensions>(defaultDimensions);
  const [unit, setUnit] = useState<'cm' | 'mm'>('cm');
  const [isExporting, setIsExporting] = useState(false);

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
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      <Sidebar
        dimensions={dimensions}
        onChange={handleDimensionChange}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white shadow-sm z-10 flex justify-between items-center p-4">
          <h1 className="text-xl font-bold text-gray-800">{t('app_title')}</h1>

          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-600">{t('units')}:</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'cm' | 'mm')}
                className="border border-gray-300 rounded px-2 py-1"
              >
                <option value="cm">{t('cm')}</option>
                <option value="mm">{t('mm')}</option>
              </select>
            </div>

            <button
              onClick={toggleLanguage}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded transition-colors text-sm font-medium"
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
          <div className="flex-1 relative bg-gray-50 border-r border-gray-200">
            <CanvasView dimensions={dimensions} metrics={metrics} />
          </div>

          <FlightAssistant
            metrics={metrics}
            checks={validationChecks}
            unit={unit}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
