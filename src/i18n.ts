import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "app_title": "AeroBuilder",
      "units": "Units",
      "cm": "Centimeters (cm)",
      "mm": "Millimeters (mm)",
      "language": "Language",
      "wing": "Wing",
      "wingspan": "Wingspan",
      "root_chord": "Root Chord",
      "tip_chord": "Tip Chord",
      "sweep_angle": "Sweep Offset",
      "tail": "Tail",
      "hstab_span": "Horiz. Stab. Span",
      "hstab_chord": "Horiz. Stab. Chord",
      "vstab_span": "Vert. Stab. Span",
      "vstab_chord": "Vert. Stab. Chord",
      "fuselage": "Fuselage",
      "total_length": "Total Length",
      "nose_length": "Nose Length (to wing root)",
      "wing_to_tail": "Wing TE to Tail LE",
      "flight_assistant": "Flight Assistant",
      "mac": "Mean Aerodynamic Chord (MAC)",
      "cg_position": "Theoretical CG (28% MAC)",
      "aspect_ratio": "Aspect Ratio",
      "tail_moment_arm": "Tail Moment Arm",
      "hstab_area": "Horiz. Stab. Area",
      "vstab_area": "Vert. Stab. Area",
      "export_pdf": "Export to PDF",
      "status_stable": "Stable",
      "status_warning": "Warning",
      "status_unstable": "Unstable/Unflyable",
      "ar_warning_high": "Warning: Aspect Ratio is high. Wing might be fragile.",
      "ar_warning_low": "Warning: Aspect Ratio is low. Wing might be inefficient.",
      "tail_arm_short": "Warning: Tail moment arm is too short. Increase fuselage length or move the tail further back to ensure pitch stability.",
      "tail_arm_long": "Warning: Tail moment arm is long. May cause issues with yaw stability or weight.",
      "hstab_area_small": "Warning: Horizontal stabilizer area is too small for proper pitch authority.",
      "hstab_area_large": "Warning: Horizontal stabilizer area is larger than necessary, creating drag.",
      "vstab_area_small": "Warning: Vertical stabilizer area is too small for proper yaw authority.",
      "control_surfaces": "Control Surfaces Recommendations",
      "ailerons_rec": "Ailerons: 10-15% of half-wing area",
      "elevator_rec": "Elevator: 25-30% of Horizontal Stabilizer",
      "rudder_rec": "Rudder: 30-50% of Vertical Stabilizer",
      "top_view": "Top View",
      "side_view": "Side View",
      "export_loading": "Generating PDF...",
    }
  },
  pt: {
    translation: {
      "app_title": "AeroBuilder",
      "units": "Unidades",
      "cm": "Centímetros (cm)",
      "mm": "Milímetros (mm)",
      "language": "Idioma",
      "wing": "Asa",
      "wingspan": "Envergadura",
      "root_chord": "Corda na Raiz",
      "tip_chord": "Corda na Ponta",
      "sweep_angle": "Enflechamento (Avanço)",
      "tail": "Cauda",
      "hstab_span": "Envergadura do Estabilizador Horiz.",
      "hstab_chord": "Corda do Estabilizador Horiz.",
      "vstab_span": "Envergadura do Estabilizador Vert.",
      "vstab_chord": "Corda do Estabilizador Vert.",
      "fuselage": "Fuselagem",
      "total_length": "Comprimento Total",
      "nose_length": "Comprimento do Nariz (até a raiz da asa)",
      "wing_to_tail": "Fuga da Asa até Bordo de Ataque da Cauda",
      "flight_assistant": "Assistente de Voo",
      "mac": "Corda Aerodinâmica Média (MAC)",
      "cg_position": "CG Teórico (28% MAC)",
      "aspect_ratio": "Alongamento (Aspect Ratio)",
      "tail_moment_arm": "Braço de Momento da Cauda",
      "hstab_area": "Área do Estabilizador Horiz.",
      "vstab_area": "Área do Estabilizador Vert.",
      "export_pdf": "Exportar para PDF",
      "status_stable": "Estável",
      "status_warning": "Aviso",
      "status_unstable": "Instável/Não voável",
      "ar_warning_high": "Aviso: Alongamento alto. A asa pode ser frágil.",
      "ar_warning_low": "Aviso: Alongamento baixo. A asa pode ser ineficiente.",
      "tail_arm_short": "Aviso: Braço de momento da cauda muito curto. Aumente o comprimento da fuselagem ou mova a cauda mais para trás para garantir estabilidade longitudinal.",
      "tail_arm_long": "Aviso: Braço de momento da cauda muito longo. Pode causar problemas de estabilidade direcional ou excesso de peso.",
      "hstab_area_small": "Aviso: Área do estabilizador horizontal muito pequena para controle de arfagem adequado.",
      "hstab_area_large": "Aviso: Área do estabilizador horizontal maior que o necessário, gerando arrasto.",
      "vstab_area_small": "Aviso: Área do estabilizador vertical muito pequena para controle de guinada adequado.",
      "control_surfaces": "Recomendações de Superfícies de Controle",
      "ailerons_rec": "Ailerons: 10-15% da área de meia asa",
      "elevator_rec": "Profundor: 25-30% do Estabilizador Horizontal",
      "rudder_rec": "Leme: 30-50% do Estabilizador Vertical",
      "top_view": "Vista Superior",
      "side_view": "Vista Lateral",
      "export_loading": "Gerando PDF...",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;