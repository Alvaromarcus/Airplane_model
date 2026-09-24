import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun, Printer } from 'lucide-react';
import Sidebar from './components/Sidebar';
import FlightAssistant from './components/FlightAssistant';
import CanvasView from './components/CanvasView';
import Scene3D from './components/Scene3D';
import AircraftTypeSelector from './components/AircraftTypeSelector';
import AppLogo from './components/AppLogo';
import {
  calculateMetrics, validateDesign, AIRCRAFT_PRESETS, DEFAULT_CONTROL_SURFACES,
  LENGTH_KEYS, dimsInUnit, normalizeDims, sanitizeControls,
} from './utils/calculations';
import type { AircraftDimensions, AircraftType, AircraftPreset, AirfoilType, FuselageType, PropellerType, ControlSurfaces } from './utils/calculations';
import { computeLayout } from './utils/geometry';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from './utils/printParts';
import StlExportDialog from './components/StlExportDialog';
import { exportToPDF } from './utils/pdfExport';
import { useVersionCheck } from './hooks/useVersionCheck';
import './App.css';

const defaultDimensions: AircraftDimensions = AIRCRAFT_PRESETS[0].defaults;

const STORAGE_KEY = 'aerobuilder_state_v2';
const LEGACY_DIMS_KEY = 'aerobuilder_dims';

interface PersistedState {
  dimensions: AircraftDimensions;
  unit: 'cm' | 'mm';
  aircraftType: AircraftType;
  airfoil: AirfoilType;
  fuselageStyle: FuselageType;
  propeller: PropellerType;
  controls: ControlSurfaces;
  isDarkMode: boolean;
  printSettings: PrintSettings;
}

const DEFAULT_STATE: PersistedState = {
  dimensions: defaultDimensions,
  unit: 'cm',
  aircraftType: 'conventional',
  airfoil: 'clarky',
  fuselageStyle: 'trainer',
  propeller: 'prop_9x47',
  controls: DEFAULT_CONTROL_SURFACES.conventional,
  isDarkMode: false,
  printSettings: DEFAULT_PRINT_SETTINGS,
};

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PersistedState>;
      const type: AircraftType = p.aircraftType === 'flying_wing' ? 'flying_wing' : 'conventional';
      const unit = p.unit === 'mm' ? 'mm' : 'cm';
      const presetDims = dimsInUnit(AIRCRAFT_PRESETS.find(x => x.type === type)!.defaults, unit);
      return {
        ...DEFAULT_STATE,
        ...p,
        aircraftType: type,
        unit,
        dimensions: normalizeDims(p.dimensions, presetDims),
        controls: sanitizeControls({ ...DEFAULT_CONTROL_SURFACES[type], ...(p.controls ?? {}) }),
        printSettings: { ...DEFAULT_PRINT_SETTINGS, ...(p.printSettings ?? {}) },
      };
    }
    // Older versions stored only the dimensions (always in cm, conventional)
    const legacy = localStorage.getItem(LEGACY_DIMS_KEY);
    if (legacy) {
      return { ...DEFAULT_STATE, dimensions: normalizeDims(JSON.parse(legacy), defaultDimensions) };
    }
  } catch (e) {
    console.error('Failed to load saved state', e);
  }
  return DEFAULT_STATE;
}

function App() {
  useVersionCheck();
  const { t, i18n } = useTranslation();

  const [initial] = useState(loadState);
  const [dimensions, setDimensions] = useState<AircraftDimensions>(initial.dimensions);
  const [unit, setUnit] = useState<'cm' | 'mm'>(initial.unit);
  const [aircraftType, setAircraftType] = useState<AircraftType>(initial.aircraftType);
  const [airfoil, setAirfoil] = useState<AirfoilType>(initial.airfoil);
  const [fuselageStyle, setFuselageStyle] = useState<FuselageType>(initial.fuselageStyle);
  const [propeller, setPropeller] = useState<PropellerType>(initial.propeller);
  const [controls, setControls] = useState<ControlSurfaces>(initial.controls);
  const [isExporting, setIsExporting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(initial.isDarkMode);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [printSettings, setPrintSettings] = useState<PrintSettings>(initial.printSettings);
  const [stlOpen, setStlOpen] = useState(false);

  // Persist the whole project (dimensions are meaningless without their unit/type)
  useEffect(() => {
    try {
      const state: PersistedState = { dimensions, unit, aircraftType, airfoil, fuselageStyle, propeller, controls, isDarkMode, printSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.removeItem(LEGACY_DIMS_KEY);
    } catch { /* storage unavailable (private mode) — ignore */ }
  }, [dimensions, unit, aircraftType, airfoil, fuselageStyle, propeller, controls, isDarkMode, printSettings]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const metrics = useMemo(() => calculateMetrics(dimensions, aircraftType, controls), [dimensions, aircraftType, controls]);
  const validationChecks = useMemo(() => validateDesign(dimensions, metrics, aircraftType), [dimensions, metrics, aircraftType]);
  const layout = useMemo(
    () => computeLayout(dimensions, aircraftType, controls, metrics, unit, fuselageStyle, propeller),
    [dimensions, aircraftType, controls, metrics, unit, fuselageStyle, propeller],
  );

  const handleUnitToggle = (newUnit: 'cm' | 'mm') => {
    if (unit === newUnit) return;

    const multiplier = newUnit === 'mm' ? 10 : 0.1;

    setDimensions(prev => {
      const newDims = { ...prev };
      // Convert lengths only (dihedral is in degrees)
      LENGTH_KEYS.forEach(key => {
        newDims[key] = parseFloat((newDims[key] * multiplier).toFixed(2));
      });
      return newDims;
    });

    setUnit(newUnit);
  };

  const handleDimensionChange = (key: keyof AircraftDimensions, value: number) => {
    setDimensions(prev => ({ ...prev, [key]: value }));
  };

  const handleControlChange = (key: keyof ControlSurfaces, value: number) => {
    setControls(prev => ({ ...prev, [key]: value }));
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'pt' : 'en';
    i18n.changeLanguage(newLang);
    try { localStorage.setItem('aerobuilder_lang', newLang); } catch { /* ignore */ }
    document.documentElement.lang = newLang === 'pt' ? 'pt-BR' : 'en-US';
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF(dimensions, metrics, validationChecks, unit, i18n.language, t, layout, controls, aircraftType, airfoil);
    } catch (error) {
      console.error("PDF Export failed", error);
    }
    setIsExporting(false);
  };

  const handleReset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setDimensions(defaultDimensions);
    setUnit('cm');
    setAircraftType('conventional');
    setAirfoil('clarky');
    setFuselageStyle('trainer');
    setPropeller('prop_9x47');
    setControls(DEFAULT_CONTROL_SURFACES.conventional);
  };

  const handlePresetSelect = (preset: AircraftPreset) => {
    setAircraftType(preset.type);
    // Presets are authored in cm — convert to the unit currently in use
    setDimensions(dimsInUnit(preset.defaults, unit));
    setControls(DEFAULT_CONTROL_SURFACES[preset.type]);
    // Auto-select sensible defaults for each aircraft type
    if (preset.type === 'flying_wing') {
      setPropeller('prop_9x47P');
      setAirfoil('mh45');
    } else {
      setPropeller('prop_9x47');
      setAirfoil('clarky');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden font-sans transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 shadow-sm z-10 flex flex-wrap gap-2 justify-between items-center p-4 transition-colors duration-200 flex-shrink-0">
        <AppLogo />

        <div className="flex items-center gap-1 sm:gap-3 flex-wrap justify-end">
          {/* Dark mode toggle — icon only, always visible */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors flex-shrink-0"
            title={isDarkMode ? t('light_mode') : t('dark_mode')}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* View toggle */}
          <button
            onClick={() => setViewMode(prev => prev === '2D' ? '3D' : '2D')}
            className="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded transition-colors text-sm font-medium border border-indigo-200 dark:border-indigo-800 flex-shrink-0"
          >
            {viewMode === '2D' ? t('view_3d') : t('view_2d')}
          </button>

          {/* Unit select — hide label on mobile, show on sm+ */}
          <div className="flex items-center gap-1 text-sm">
            <span className="hidden sm:inline font-medium text-gray-600 dark:text-gray-300">{t('units')}:</span>
            <select
              value={unit}
              onChange={(e) => handleUnitToggle(e.target.value as 'cm' | 'mm')}
              className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm"
            >
              <option value="cm">{t('cm')}</option>
              <option value="mm">{t('mm')}</option>
            </select>
          </div>

          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className="hidden sm:block bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs font-medium transition-colors"
          >
            {i18n.language === 'en' ? 'PT-BR' : 'EN'}
          </button>

          <button
            onClick={handleReset}
            className="hidden sm:block bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 px-2 py-1 rounded transition-colors text-xs font-medium border border-red-200 dark:border-red-800"
          >
            {t('reset')}
          </button>

          {/* STL export for 3D printing */}
          <button
            onClick={() => setStlOpen(true)}
            className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded transition-colors text-sm font-medium flex items-center gap-1.5"
            title={t('stl_title')}
          >
            <Printer size={14} aria-hidden="true" />
            <span>STL</span>
          </button>

          {/* PDF export — always fully visible, icon + text on mobile */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded transition-colors text-sm font-medium flex items-center gap-1.5"
          >
            {/* Inline PDF icon */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 0h6l4 4v11a1 1 0 01-1 1H3a1 1 0 01-1-1V1a1 1 0 011-1zm6 1v3h3L10 1zM5 9h6v1H5V9zm0 2h6v1H5v-1zm0-4h3v1H5V7z"/>
            </svg>
            <span className="sm:hidden">PDF</span>
            <span className="hidden sm:inline">
              {isExporting ? t('export_loading') : t('export_pdf')}
            </span>
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
            controls={controls}
            onControlChange={handleControlChange}
            metrics={metrics}
            unit={unit}
            aircraftType={aircraftType}
            airfoil={airfoil}
            onAirfoilChange={setAirfoil}
            fuselageStyle={fuselageStyle}
            onFuselageStyleChange={setFuselageStyle}
            propeller={propeller}
            onPropellerChange={setPropeller}
          />
        </div>

        <div className="order-1 lg:order-2 w-full lg:flex-1 relative min-h-[400px] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-x-auto">
          {viewMode === '2D' ? (
            <CanvasView layout={layout} isDarkMode={isDarkMode} airfoil={airfoil} />
          ) : (
            <Scene3D layout={layout} airfoil={airfoil} isDarkMode={isDarkMode} printSettings={printSettings} />
          )}
        </div>

        <div className="order-2 lg:order-3 w-full lg:w-80 flex-shrink-0">
          <FlightAssistant
            metrics={metrics}
            checks={validationChecks}
            unit={unit}
            isDarkMode={isDarkMode}
            aircraftType={aircraftType}
            dimensions={dimensions}
          />
        </div>
      </main>
      <StlExportDialog
        open={stlOpen}
        onClose={() => setStlOpen(false)}
        layout={layout}
        airfoil={airfoil}
        settings={printSettings}
        onSettingsChange={setPrintSettings}
      />
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-2 text-center text-xs text-gray-500 dark:text-gray-400 transition-colors duration-200 z-20">
        {t('developed_by')} <a href="https://www.linkedin.com/in/alvaromarcus/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Alvaro Marcus</a>
      </footer>
    </div>
  );
}

export default App;
