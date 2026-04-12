import { jsPDF } from 'jspdf';
import type { AircraftDimensions, AircraftMetrics, ValidationCheck } from './calculations';

export async function exportToPDF(
  dims: AircraftDimensions,
  metrics: AircraftMetrics,
  checks: ValidationCheck[],
  unit: 'cm' | 'mm',
  lang: string,
  t: (key: string) => string
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // ==========================================
  // PAGE 1: OVERVIEW & METRICS
  // ==========================================

  // Header block
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('AeroBuilder', 15, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(lang === 'pt' ? "Relatório de Projeto de Aeromodelo" : "RC Aircraft Design Report", 15, 30);

  doc.text(`${new Date().toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US')}`, 195, 22, { align: 'right' });

  // Horizontal rule
  doc.setDrawColor(220, 220, 220);
  doc.line(15, 35, 195, 35);

  // Metrics Table (y=40)
  let y = 40;

  // Table Header
  doc.setFillColor(37, 99, 235); // bg-blue-600
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("Parameter", 17, y + 5.5);
  doc.text("Value", 117, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');

  const rows = [
    { label: t('mac'), value: `${metrics.mac.toFixed(1)} ${unit}` },
    { label: t('cg_position'), value: `${metrics.cgPosition.toFixed(1)} ${unit}  (28% MAC)` },
    { label: t('neutral_point'), value: `${metrics.neutralPoint.toFixed(1)} ${unit}` },
    { label: t('static_margin'), value: `${metrics.staticMargin.toFixed(1)} %` },
    { label: t('aspect_ratio'), value: `${metrics.aspectRatio.toFixed(2)}` },
    { label: t('tail_moment_arm'), value: `${metrics.tailMomentArm.toFixed(1)} ${unit}` },
    { label: t('wing_area'), value: `${metrics.wingArea.toFixed(0)} ${unit}²` },
    { label: t('hstab_area'), value: `${metrics.hStabArea.toFixed(0)} ${unit}²` },
    { label: t('vstab_area'), value: `${metrics.vStabArea.toFixed(0)} ${unit}²` },
    { label: t('chart_vbar_label'), value: `${metrics.tailVolumeCoefficient.toFixed(3)}` },
  ];

  rows.forEach((row, i) => {
    // Alternating bg
    if (i % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(15, y, 180, 8, 'F');
    }

    doc.setTextColor(0, 0, 0);
    doc.text(row.label, 17, y + 5.5);
    doc.text(row.value, 117, y + 5.5);
    y += 8;
  });

  // Analysis Section
  y += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(t('analysis'), 15, y);
  y += 6;

  if (checks.length === 0) {
    doc.setTextColor(34, 197, 94); // green-500
    doc.setFont('helvetica', 'normal');
    doc.text(t('status_stable'), 15, y);
    y += 8;
  } else {
    checks.forEach(check => {
      // Color box
      if (check.level === 'unstable') {
        doc.setFillColor(239, 68, 68); // red-500
      } else {
        doc.setFillColor(245, 158, 11); // amber-500
      }
      doc.rect(15, y - 2, 3, 3, 'F');

      // Message
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const msgLines = doc.splitTextToSize(t(check.messageKey), 160);
      doc.text(msgLines, 20, y);
      y += msgLines.length * 4;

      // Fix Suggestion
      if (check.fixKey) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const fixLines = doc.splitTextToSize(`→ ${t(check.fixKey)}`, 160);
        doc.text(fixLines, 23, y);
        y += fixLines.length * 3.5 + 2;
      } else {
        y += 2;
      }
    });
  }

  // Formula Section
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(lang === 'pt' ? "Fórmulas Aerodinâmicas" : "Aerodynamic Formulas", 15, y);
  y += 6;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);

  const formulas = [
    "MAC  = (2/3) × Cr × (1 + λ + λ²) / (1 + λ)",
    "NP   = AC_wing + lt × (St/Sw) × η × (1 − dε/dα)",
    "SM   = (NP − CG) / MAC × 100 %",
    "Vbar = (St × lt) / (Sw × MAC)",
    "",
    "η = 0.90  |  dε/dα = 2×CLα / (π×AR)  |  CLα = 2π×AR / (2 + √(AR²+4))"
  ];

  formulas.forEach(f => {
    doc.text(f, 15, y);
    y += 4;
  });

  doc.setFont('helvetica', 'normal');

  // Footer on page 1
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text('AeroBuilder — aerobuilder.app', 105, 287, { align: 'center' });


  // ==========================================
  // PAGES 2+: SCALE TEMPLATES
  // ==========================================

  const a4WidthMm = 210;
  const a4HeightMm = 297;

  // Calculate bounding box of the aircraft (Top View)
  const maxAircraftLength = Math.max(
    dims.fuselageLength,
    dims.noseLength + dims.rootChord + dims.wingToTailDistance + dims.hStabChord
  );

  const scaleToMm = unit === 'cm' ? 10 : 1;
  const widthMm = dims.wingspan * scaleToMm;
  const heightMm = maxAircraftLength * scaleToMm;

  const halfWidthMm = widthMm / 2;

  // Add extra height to accommodate the Vertical Stabilizer and Fuselage profile
  const extraHeightMm = 20 + (dims.vStabSpan * scaleToMm) + 20 + (dims.fuselageLength * scaleToMm) + 20;
  const totalDrawingHeightMm = heightMm + extraHeightMm;

  // Ensure the width accommodates the fuselage profile (drawn at 50mm width)
  const maxRequiredWidthMm = Math.max(halfWidthMm, 50);

  const cols = Math.ceil(maxRequiredWidthMm / a4WidthMm);
  const numRows = Math.ceil(totalDrawingHeightMm / a4HeightMm);

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < cols; col++) {
      doc.addPage();

      // Title strip at top of each template page
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      const titleStr = lang === 'pt'
        ? "Template em escala 1:1 — recorte e monte"
        : "1:1 Scale Template — cut out and assemble";
      doc.text(titleStr, 15, 10);
      doc.setFont('helvetica', 'normal');

      const offsetX = col * a4WidthMm;
      const offsetY = row * a4HeightMm;

      // Draw grid / alignment markers
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);

      const crosshairSize = 10;
      const drawCrosshair = (x: number, y: number) => {
        doc.line(x - crosshairSize/2, y, x + crosshairSize/2, y);
        doc.line(x, y - crosshairSize/2, x, y + crosshairSize/2);
      };

      drawCrosshair(10, 15);
      drawCrosshair(a4WidthMm - 10, 15);
      drawCrosshair(10, a4HeightMm - 10);
      drawCrosshair(a4WidthMm - 10, a4HeightMm - 10);

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page Row ${row + 1}, Col ${col + 1} - AeroBuilder Template`, 15, 20);
      doc.text(`Alignment markers at corners. Overlap & tape pages.`, 15, 25);

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);

      const wingY = dims.noseLength * scaleToMm;

      const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        // Y offset is slightly increased by 15mm because of the header title
        doc.line(x1 - offsetX, y1 - offsetY + 15, x2 - offsetX, y2 - offsetY + 15);
      };

      const textLine = (text: string, x: number, y: number) => {
        doc.text(text, x - offsetX, y - offsetY + 15);
      };

      // --- Draw Half Wing ---
      drawLine(0, wingY, 0, wingY + (dims.rootChord * scaleToMm)); // Root
      drawLine(0, wingY, halfWidthMm, wingY + (dims.sweepOffset * scaleToMm)); // LE
      drawLine(halfWidthMm, wingY + (dims.sweepOffset * scaleToMm), halfWidthMm, wingY + (dims.sweepOffset * scaleToMm) + (dims.tipChord * scaleToMm)); // Tip
      drawLine(halfWidthMm, wingY + (dims.sweepOffset * scaleToMm) + (dims.tipChord * scaleToMm), 0, wingY + (dims.rootChord * scaleToMm)); // TE

      // Wing Annotations
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      textLine(`${t('wingspan')}: ${dims.wingspan} ${unit}`, 2, wingY - 3);
      textLine(`${t('root_chord')}: ${dims.rootChord} ${unit}`, 2, wingY + 5);
      doc.setDrawColor(0, 0, 0);

      // --- Draw Half Horizontal Stabilizer ---
      const hStabY = wingY + (dims.rootChord * scaleToMm) + (dims.wingToTailDistance * scaleToMm);
      const halfHStabSpan = (dims.hStabSpan / 2) * scaleToMm;
      const hStabChord = dims.hStabChord * scaleToMm;

      drawLine(0, hStabY, halfHStabSpan, hStabY); // LE
      drawLine(halfHStabSpan, hStabY, halfHStabSpan, hStabY + hStabChord); // Tip
      drawLine(halfHStabSpan, hStabY + hStabChord, 0, hStabY + hStabChord); // TE
      drawLine(0, hStabY + hStabChord, 0, hStabY); // Root

      // HStab Annotations
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      textLine(`${t('hstab_span')}: ${dims.hStabSpan} ${unit}`, 2, hStabY - 2);
      doc.setDrawColor(0, 0, 0);

      // --- Draw Vertical Stabilizer ---
      const vStabY = heightMm + 20;
      const vStabChord = dims.vStabChord * scaleToMm;
      const vStabSpanMm = dims.vStabSpan * scaleToMm;

      drawLine(0, vStabY, vStabChord, vStabY); // Root
      drawLine(vStabChord, vStabY, vStabChord, vStabY + vStabSpanMm); // Span/TE
      drawLine(vStabChord, vStabY + vStabSpanMm, 0, vStabY + vStabSpanMm); // Tip
      drawLine(0, vStabY + vStabSpanMm, 0, vStabY); // LE

      // VStab Annotations
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      textLine(`${t('vstab_span')}: ${dims.vStabSpan} ${unit}`, 2, vStabY - 2);
      doc.setDrawColor(0, 0, 0);

      // --- Draw Fuselage Profile ---
      const fuselageY = vStabY + vStabSpanMm + 20;
      const fuselageLengthMm = dims.fuselageLength * scaleToMm;
      const fuselageWidthMm = 50;

      drawLine(0, fuselageY, fuselageWidthMm, fuselageY); // Top
      drawLine(fuselageWidthMm, fuselageY, fuselageWidthMm, fuselageY + fuselageLengthMm); // Side
      drawLine(fuselageWidthMm, fuselageY + fuselageLengthMm, 0, fuselageY + fuselageLengthMm); // Bottom
      drawLine(0, fuselageY + fuselageLengthMm, 0, fuselageY); // Centerline edge

      // --- Draw Centerline ---
      doc.setDrawColor(255, 0, 0);
      doc.setLineDashPattern([5, 5], 0);
      drawLine(0, 0, 0, totalDrawingHeightMm);
      doc.setLineDashPattern([], 0);

      // --- CG Marker ---
      const cgPdfY = dims.noseLength * scaleToMm + metrics.cgPosition * scaleToMm;
      doc.setFillColor(0, 120, 255);
      // We apply the same +15 header offset used in drawLine
      const cgYWithOffset = cgPdfY - offsetY + 15;
      doc.circle(5 - offsetX, cgYWithOffset, 2, 'F');
      doc.setFontSize(6);
      doc.text(`CG`, 8 - offsetX, cgYWithOffset + 1);

      // --- Scale bar (bottom of first template page only) ---
      if (row === 0 && col === 0) {
        doc.setDrawColor(0);
        doc.setLineWidth(0.5);
        doc.line(15, a4HeightMm - 15, 65, a4HeightMm - 15);
        doc.line(15, a4HeightMm - 17, 15, a4HeightMm - 13);
        doc.line(65, a4HeightMm - 17, 65, a4HeightMm - 13);
        doc.setFontSize(7);
        doc.text('50 mm', 40, a4HeightMm - 10, { align: 'center' });
      }

      doc.setDrawColor(0, 0, 0);
    }
  }

  doc.save('aerobuilder-templates.pdf');
}