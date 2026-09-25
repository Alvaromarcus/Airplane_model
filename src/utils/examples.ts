/**
 * Ready-made example projects. Each one was checked with the analysis and the
 * weight & balance model (no validation errors, balances without ballast
 * unless stated), so users can start from something that flies.
 * Dimensions are in cm.
 */
import type { AircraftDimensions, AircraftType, AirfoilType, ControlSurfaces, FuselageType, PropellerType } from './calculations';
import type { ComponentSettings } from './components';

export interface ExampleProject {
  id: string;
  name: { pt: string; en: string };
  description: { pt: string; en: string };
  tags: { pt: string; en: string }[];
  state: {
    dimensions: AircraftDimensions;
    unit: 'cm';
    aircraftType: AircraftType;
    airfoil: AirfoilType;
    fuselageStyle: FuselageType;
    propeller: PropellerType;
    controls: ControlSurfaces;
    components: ComponentSettings;
    propCutout: boolean;
  };
}

const CONV_CS: ControlSurfaces = { aileronStart: 50, aileronEnd: 95, aileronChord: 25, elevatorChord: 30, rudderChord: 40, fwStaticMargin: 6 };

export const EXAMPLES: ExampleProject[] = [
  {
    id: 'trainer100',
    name: { pt: 'Treinador 1 m', en: 'Trainer 1 m' },
    description: {
      pt: 'Asa alta, Clark-Y e diedro: estável e fácil de pilotar. Ótimo primeiro avião.',
      en: 'High wing, Clark-Y and dihedral: stable and easy to fly. A great first plane.',
    },
    tags: [{ pt: 'Iniciante', en: 'Beginner' }, { pt: '3S', en: '3S' }],
    state: {
      dimensions: { wingspan: 100, rootChord: 20, tipChord: 15, sweepOffset: 5, dihedral: 5, hStabSpan: 32, hStabChord: 9, vStabSpan: 15, vStabChord: 10, fuselageLength: 80, noseLength: 15, wingToTailDistance: 32, fuselageWidth: 7, fuselageHeight: 8 },
      unit: 'cm', aircraftType: 'conventional', airfoil: 'clarky', fuselageStyle: 'trainer', propeller: 'prop_9x47',
      controls: CONV_CS, components: { servo: 'sg90', battery: 'auto' }, propCutout: false,
    },
  },
  {
    id: 'trainer140',
    name: { pt: 'Treinador 1,4 m', en: 'Trainer 1.4 m' },
    description: {
      pt: 'Versão maior do treinador: voa mais devagar, aguenta vento e leva uma bateria maior.',
      en: 'A bigger trainer: flies slower, handles wind and carries a larger battery.',
    },
    tags: [{ pt: 'Iniciante', en: 'Beginner' }, { pt: 'Asa alta', en: 'High wing' }],
    state: {
      dimensions: { wingspan: 140, rootChord: 26, tipChord: 20, sweepOffset: 5, dihedral: 4, hStabSpan: 44, hStabChord: 11.5, vStabSpan: 20, vStabChord: 14, fuselageLength: 112, noseLength: 25, wingToTailDistance: 42, fuselageWidth: 9, fuselageHeight: 10 },
      unit: 'cm', aircraftType: 'conventional', airfoil: 'clarky', fuselageStyle: 'trainer', propeller: 'prop_11x55',
      controls: CONV_CS, components: { servo: 'sg90', battery: 'auto' }, propCutout: false,
    },
  },
  {
    id: 'sport110',
    name: { pt: 'Esportivo 1,1 m', en: 'Sport 1.1 m' },
    description: {
      pt: 'Asa média com perfil simétrico e pouco diedro: faz loop, tunô e voo invertido.',
      en: 'Mid wing, symmetrical airfoil and little dihedral: loops, rolls and inverted flight.',
    },
    tags: [{ pt: 'Intermediário', en: 'Intermediate' }, { pt: 'Acrobacia', en: 'Aerobatics' }],
    state: {
      dimensions: { wingspan: 110, rootChord: 24, tipChord: 17, sweepOffset: 5, dihedral: 2, hStabSpan: 38, hStabChord: 10.5, vStabSpan: 17, vStabChord: 13, fuselageLength: 92, noseLength: 19, wingToTailDistance: 35, fuselageWidth: 7.5, fuselageHeight: 8.5 },
      unit: 'cm', aircraftType: 'conventional', airfoil: 'naca0012', fuselageStyle: 'sport', propeller: 'prop_10x47',
      controls: { ...CONV_CS, aileronStart: 40, aileronChord: 26, elevatorChord: 35, rudderChord: 45 },
      components: { servo: 'mg90s', battery: 'auto' }, propCutout: false,
    },
  },
  {
    id: 'glider160',
    name: { pt: 'Motoplanador 1,6 m', en: 'Motor glider 1.6 m' },
    description: {
      pt: 'Asa longa para termais e voo calmo; motor só para subir. O alongamento alto é intencional (o assistente avisa: reforce a longarina).',
      en: 'Long wing for thermals and calm flying; the motor is for the climb. The high aspect ratio is intentional (the assistant flags it: use a stiff spar).',
    },
    tags: [{ pt: 'Planador', en: 'Glider' }, { pt: 'Voo lento', en: 'Slow flyer' }],
    state: {
      dimensions: { wingspan: 160, rootChord: 22, tipChord: 13, sweepOffset: 4, dihedral: 6, hStabSpan: 40, hStabChord: 10.5, vStabSpan: 18, vStabChord: 13, fuselageLength: 90, noseLength: 24, wingToTailDistance: 28, fuselageWidth: 6, fuselageHeight: 7 },
      unit: 'cm', aircraftType: 'conventional', airfoil: 'naca4412', fuselageStyle: 'sport', propeller: 'prop_9x47',
      controls: { ...CONV_CS, aileronStart: 55, aileronChord: 22 },
      components: { servo: 'sg90', battery: 'auto' }, propCutout: false,
    },
  },
  {
    id: 'zagi90',
    name: { pt: 'Asa voadora estilo Zagi 90 cm', en: 'Zagi-style flying wing 90 cm' },
    description: {
      pt: 'Asa bem enflechada com MH45, winglets e hélice pusher no recorte do bordo de fuga. Balanceia com 3S 1800 no bico, sem lastro.',
      en: 'Strongly swept wing with MH45, winglets and a pusher prop in the trailing-edge cut-out. Balances with a 3S 1800 in the nose, no ballast.',
    },
    tags: [{ pt: 'Asa voadora', en: 'Flying wing' }, { pt: 'Rápida', en: 'Fast' }],
    state: {
      dimensions: { wingspan: 90, rootChord: 26, tipChord: 13, sweepOffset: 30, dihedral: 2, hStabSpan: 0, hStabChord: 0, vStabSpan: 8, vStabChord: 6, fuselageLength: 30, noseLength: 0, wingToTailDistance: 0, fuselageWidth: 0, fuselageHeight: 0 },
      unit: 'cm', aircraftType: 'flying_wing', airfoil: 'mh45', fuselageStyle: 'trainer', propeller: 'prop_8x45P',
      controls: { aileronStart: 30, aileronEnd: 95, aileronChord: 22, elevatorChord: 0, rudderChord: 0, fwStaticMargin: 6 },
      components: { servo: 'sg90', battery: 'auto' }, propCutout: true,
    },
  },
  {
    id: 'wing120',
    name: { pt: 'Asa voadora 1,2 m (FPV)', en: 'Flying wing 1.2 m (FPV)' },
    description: {
      pt: 'Asa maior e mais calma, com espaço no centro para bateria e eletrônica de FPV. Carga alar baixa: voa devagar.',
      en: 'Larger, calmer wing with room in the centre for the battery and FPV gear. Low wing loading: flies slowly.',
    },
    tags: [{ pt: 'Asa voadora', en: 'Flying wing' }, { pt: 'FPV', en: 'FPV' }],
    state: {
      dimensions: { wingspan: 120, rootChord: 30, tipChord: 17, sweepOffset: 42, dihedral: 1, hStabSpan: 0, hStabChord: 0, vStabSpan: 12, vStabChord: 9, fuselageLength: 32, noseLength: 0, wingToTailDistance: 0, fuselageWidth: 0, fuselageHeight: 0 },
      unit: 'cm', aircraftType: 'flying_wing', airfoil: 'mh45', fuselageStyle: 'trainer', propeller: 'prop_8x45P',
      controls: { aileronStart: 30, aileronEnd: 95, aileronChord: 20, elevatorChord: 0, rudderChord: 0, fwStaticMargin: 6 },
      components: { servo: 'sg90', battery: '3s2200' }, propCutout: true,
    },
  },
];
