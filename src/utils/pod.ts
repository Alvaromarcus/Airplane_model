/**
 * Flying-wing nose pod: finds the nose length that balances the aircraft with
 * the least ballast (shortest nose on a tie). Each try rebuilds the layout and
 * the weight & balance, so it runs on demand (button / when the pod is turned on).
 */
import { calculateMetrics, type AircraftDimensions, type AircraftType, type AirfoilType, type ControlSurfaces, type FuselageType, type PropellerType } from './calculations';
import { computeLayout } from './geometry';
import { computeBalance, type ComponentSettings } from './components';

export interface AutoNoseResult {
  /** Suggested nose length, in the project unit. */
  nose: number;
  /** Ballast still needed with that nose (g, 0 = balances). */
  ballast: number;
  /** Where that ballast goes. */
  ballastAt: 'nose' | 'tail' | null;
  /** Ballast needed without any pod, for comparison (g). */
  ballastWithout: number;
}

export function autoFwNose(
  dims: AircraftDimensions, aircraftType: AircraftType, controls: ControlSurfaces, unit: 'cm' | 'mm',
  fuselageStyle: FuselageType, propeller: PropellerType, propCutout: boolean, airfoil: AirfoilType, components: ComponentSettings,
): AutoNoseResult {
  const cm = unit === 'mm' ? 10 : 1; // project units per cm
  const evalNose = (nose: number) => {
    const d = { ...dims, fwNose: nose };
    const m = calculateMetrics(d, aircraftType, controls);
    const L = computeLayout(d, aircraftType, controls, m, unit, fuselageStyle, propeller, propCutout);
    const b = computeBalance(L, airfoil, components);
    const ballast = b.ballast ? b.ballast.mass : 0;
    const at: AutoNoseResult['ballastAt'] = b.ballast ? (b.ballast.s < b.cgTarget ? 'nose' : 'tail') : null;
    return { ballast, at };
  };
  const without = evalNose(0);
  // From 3 cm up to the root chord, 1 cm steps, then refine around the best
  const maxCm = Math.max(6, dims.rootChord / cm);
  let best = { nose: 3 * cm, ...evalNose(3 * cm) };
  for (let n = 4; n <= maxCm; n += 1) {
    const r = evalNose(n * cm);
    if (r.ballast < best.ballast - 0.5) best = { nose: n * cm, ...r };
    if (best.ballast < 0.5) break;
  }
  for (const dn of [-0.6, -0.3, 0.3]) {
    const n = best.nose + dn * cm;
    if (n < 2 * cm) continue;
    const r = evalNose(n);
    if (r.ballast < best.ballast - 0.5 || (r.ballast < 0.5 && best.ballast < 0.5 && n < best.nose)) best = { nose: n, ...r };
  }
  const round = (v: number) => (unit === 'mm' ? Math.round(v) : Math.round(v * 10) / 10);
  return { nose: round(best.nose), ballast: Math.round(best.ballast), ballastAt: best.at, ballastWithout: Math.round(without.ballast) };
}
