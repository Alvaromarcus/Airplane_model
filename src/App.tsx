import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './components/Sidebar';
import FlightAssistant from './components/FlightAssistant';
import CanvasView from './components/CanvasView';
import Scene3D from './components/Scene3D';
import Header from './components/Header';
import KpiBar from './components/KpiBar';
import WelcomeModal from './components/WelcomeModal';
import ExamplesDialog from './components/ExamplesDialog';
import type { ExampleProject } from './utils/examples';
import { projectFromUrl, shareUrl } from './utils/share';
import {
  calculateMetrics, validateDesign, AIRCRAFT_PRESETS, DEFAULT_CONTROL_SURFACES,
  LENGTH_KEYS, dimsInUnit, normalizeDims, sanitizeControls,
} from './utils/calculations';
import type { AircraftDimensions, AircraftType, AircraftPreset, AirfoilType, FuselageType, PropellerType, ControlSurfaces } from './utils/calculations';
import { computeLayout } from './utils/geometry';
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from './utils/printParts';
import StlExportDialog from './components/StlExportDialog';
import { computeBalance, cutoutsFromBalance, DEFAULT_COMPONENTS, type ComponentSettings } from './utils/components';
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
  components: ComponentSettings;
  propCutout: boolean;
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
  components: DEFAULT_COMPONENTS,
  propCutout: true,
};

function loadState(): PersistedState {
  try {
    // A shared link (#p=...) takes precedence over what this browser saved
    const fromUrl = projectFromUrl<Partial<PersistedState>>();
    const raw = fromUrl ? null : localStorage.getItem(STORAGE_KEY);
    if (fromUrl || raw) {
      const p = (fromUrl ?? JSON.parse(raw!)) as Partial<PersistedState>;
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
        components: { ...DEFAULT_COMPONENTS, ...(p.components ?? {}) },
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
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    try { return !localStorage.getItem('aerobuilder_welcome_seen') && !projectFromUrl(); } catch { return false; }
  });
  const closeWelcome = () => {
    setWelcomeOpen(false);
    try { localStorage.setItem('aerobuilder_welcome_seen', '1'); } catch { /* ignore */ }
  };

  // A shared link was loaded: drop the hash so later edits don't look like the shared version
  useEffect(() => {
    if (window.location.hash.includes('p=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
  const [components, setComponents] = useState<ComponentSettings>(initial.components);
  const [propCutout, setPropCutout] = useState<boolean>(initial.propCutout !== false);

  // Persist the whole project (dimensions are meaningless without their unit/type)
  useEffect(() => {
    try {
      const state: PersistedState = { dimensions, unit, aircraftType, airfoil, fuselageStyle, propeller, controls, isDarkMode, printSettings, components, propCutout };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      localStorage.removeItem(LEGACY_DIMS_KEY);
    } catch { /* storage unavailable (private mode) — ignore */ }
  }, [dimensions, unit, aircraftType, airfoil, fuselageStyle, propeller, controls, isDarkMode, printSettings, components, propCutout]);

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
    () => computeLayout(dimensions, aircraftType, controls, metrics, unit, fuselageStyle, propeller, propCutout),
    [dimensions, aircraftType, controls, metrics, unit, fuselageStyle, propeller, propCutout],
  );
  const balance = useMemo(() => {
    try {
      return computeBalance(layout, airfoil, components);
    } catch (e) {
      console.error('Balance computation failed', e);
      return null;
    }
  }, [layout, airfoil, components]);
  const pockets = useMemo(() => (balance ? cutoutsFromBalance(balance, layout) : []), [balance, layout]);

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
      await exportToPDF(dimensions, metrics, validationChecks, unit, i18n.language, t, layout, controls, aircraftType, airfoil, balance);
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
    setComponents(DEFAULT_COMPONENTS);
  };

  const handleShare = async (): Promise<boolean> => {
    const url = shareUrl({ dimensions, unit, aircraftType, airfoil, fuselageStyle, propeller, controls, printSettings, components, propCutout });
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      window.prompt(t('share_hint'), url);
      return false;
    }
  };

  const loadExample = (ex: ExampleProject) => {
    const st = ex.state;
    setDimensions(dimsInUnit(st.dimensions, unit));
    setAircraftType(st.aircraftType);
    setAirfoil(st.airfoil);
    setFuselageStyle(st.fuselageStyle);
    setPropeller(st.propeller);
    setControls(sanitizeControls(st.controls));
    setComponents(st.components);
    setPropCutout(st.propCutout);
    setExamplesOpen(false);
  };

  const handlePresetSelect = (preset: AircraftPreset) => {
    setAircraftType(preset.type);
    // Presets are authored in cm — convert to the unit currently in use
    setDimensions(dimsInUnit(preset.defaults, unit));
    setControls(DEFAULT_CONTROL_SURFACES[preset.type]);
    // Auto-select sensible defaults for each aircraft type
    if (preset.type === 'flying_wing') {
      setPropeller('prop_8x45P');
      setAirfoil('mh45');
    } else {
      setPropeller('prop_9x47');
      setAirfoil('clarky');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Header
        aircraftType={aircraftType}
        onPreset={handlePresetSelect}
        viewMode={viewMode}
        onViewMode={setViewMode}
        unit={unit}
        onUnit={handleUnitToggle}
        isDarkMode={isDarkMode}
        onToggleDark={() => setIsDarkMode(!isDarkMode)}
        onToggleLanguage={toggleLanguage}
        onReset={handleReset}
        onExportPDF={handleExportPDF}
        isExporting={isExporting}
        onOpenSTL={() => setStlOpen(true)}
        onShare={handleShare}
        onHelp={() => setWelcomeOpen(true)}
        onExamples={() => setExamplesOpen(true)}
      />
      <KpiBar metrics={metrics} checks={validationChecks} balance={balance} layout={layout} unit={unit} />

      <main className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative">
        <div className="order-2 lg:order-1 w-full lg:w-72 flex-shrink-0 z-10">
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
            propCutout={propCutout}
            onPropCutoutChange={setPropCutout}
            teCutNeedsElevonStart={layout.teCutNeedsElevonStart}
          />
        </div>

        <div className="order-1 lg:order-2 w-full lg:flex-1 relative min-h-[420px] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 overflow-x-auto bg-white dark:bg-slate-900">
          {viewMode === '2D' ? (
            <CanvasView layout={layout} isDarkMode={isDarkMode} airfoil={airfoil} balance={balance} />
          ) : (
            <Scene3D layout={layout} airfoil={airfoil} isDarkMode={isDarkMode} printSettings={printSettings} balance={balance} pockets={pockets} />
          )}
        </div>

        <div className="order-3 lg:order-3 w-full lg:w-80 flex-shrink-0">
          <FlightAssistant
            metrics={metrics}
            checks={validationChecks}
            unit={unit}
            isDarkMode={isDarkMode}
            aircraftType={aircraftType}
            dimensions={dimensions}
            balance={balance}
            components={components}
            onComponentsChange={setComponents}
            layout={layout}
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
        pockets={pockets}
        balance={balance}
      />
      <WelcomeModal open={welcomeOpen} onClose={closeWelcome} onExamples={() => { closeWelcome(); setExamplesOpen(true); }} />
      <ExamplesDialog open={examplesOpen} onClose={() => setExamplesOpen(false)} onLoad={loadExample} />
      <footer className="flex-shrink-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 z-20">
        <span>{t('developed_by')} <a href="https://www.linkedin.com/in/alvaromarcus/" target="_blank" rel="noopener noreferrer" className="text-sky-700 dark:text-sky-400 hover:underline">Alvaro Marcus</a></span>
        <span aria-hidden="true">·</span>
        <a href="https://github.com/Alvaromarcus/Airplane_model" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
        <span aria-hidden="true">·</span>
        <span>{t('footer_disclaimer')}</span>
      </footer>
    </div>
  );
}

export default App;
