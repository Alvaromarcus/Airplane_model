import { jsPDF } from 'jspdf';
import type { AircraftDimensions } from './calculations';

export async function exportToPDF(dims: AircraftDimensions, unit: 'cm' | 'mm') {
  // We want to export 1:1 scale templates.
  // Standard A4 is 210mm x 297mm
  const a4WidthMm = 210;
  const a4HeightMm = 297;

  // Calculate bounding box of the aircraft (Top View)
  const maxAircraftLength = Math.max(
    dims.fuselageLength,
    dims.noseLength + dims.rootChord + dims.wingToTailDistance + dims.hStabChord
  );

  // Convert all dimensions to mm for PDF standard
  const scaleToMm = unit === 'cm' ? 10 : 1;

  const widthMm = dims.wingspan * scaleToMm;
  const heightMm = maxAircraftLength * scaleToMm;

  // We only export half the aircraft for the template (symmetry)
  const halfWidthMm = widthMm / 2;

  // Calculate how many A4 pages are needed.
  // Add extra height to accommodate the Vertical Stabilizer and Fuselage profile drawn below the main aircraft bounding box.
  const extraHeightMm = 20 + (dims.vStabSpan * scaleToMm) + 20 + (dims.fuselageLength * scaleToMm) + 20;
  const totalDrawingHeightMm = heightMm + extraHeightMm;

  // We only export half the aircraft for the template (symmetry)
  // Ensure the width accommodates the fuselage profile (which is drawn at 50mm width)
  const maxRequiredWidthMm = Math.max(halfWidthMm, 50);

  const cols = Math.ceil(maxRequiredWidthMm / a4WidthMm);
  const rows = Math.ceil(totalDrawingHeightMm / a4HeightMm);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let isFirstPage = true;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      const offsetX = col * a4WidthMm;
      const offsetY = row * a4HeightMm;

      // Draw grid / alignment markers
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);

      // Crosshairs at corners
      const crosshairSize = 10;
      const drawCrosshair = (x: number, y: number) => {
        doc.line(x - crosshairSize/2, y, x + crosshairSize/2, y);
        doc.line(x, y - crosshairSize/2, x, y + crosshairSize/2);
      };

      drawCrosshair(10, 10);
      drawCrosshair(a4WidthMm - 10, 10);
      drawCrosshair(10, a4HeightMm - 10);
      drawCrosshair(a4WidthMm - 10, a4HeightMm - 10);

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page Row ${row + 1}, Col ${col + 1} - AeroBuilder Template`, 15, 15);
      doc.text(`Alignment markers at corners. Overlap & tape pages.`, 15, 20);

      // Set drawing styles for aircraft outline
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1);

      // --- Draw Half Wing ---
      const wingY = dims.noseLength * scaleToMm;
      // Start drawing relative to page offset
      // Since we are drawing right half, X goes from 0 to halfWidthMm

      const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        doc.line(x1 - offsetX, y1 - offsetY, x2 - offsetX, y2 - offsetY);
      };

      // Wing Root
      drawLine(0, wingY, 0, wingY + (dims.rootChord * scaleToMm));
      // Wing Leading Edge
      drawLine(0, wingY, halfWidthMm, wingY + (dims.sweepOffset * scaleToMm));
      // Wing Tip
      drawLine(halfWidthMm, wingY + (dims.sweepOffset * scaleToMm), halfWidthMm, wingY + (dims.sweepOffset * scaleToMm) + (dims.tipChord * scaleToMm));
      // Wing Trailing Edge
      drawLine(halfWidthMm, wingY + (dims.sweepOffset * scaleToMm) + (dims.tipChord * scaleToMm), 0, wingY + (dims.rootChord * scaleToMm));

      // --- Draw Half Horizontal Stabilizer ---
      const hStabY = wingY + (dims.rootChord * scaleToMm) + (dims.wingToTailDistance * scaleToMm);
      const halfHStabSpan = (dims.hStabSpan / 2) * scaleToMm;
      const hStabChord = dims.hStabChord * scaleToMm;

      drawLine(0, hStabY, halfHStabSpan, hStabY); // LE
      drawLine(halfHStabSpan, hStabY, halfHStabSpan, hStabY + hStabChord); // Tip
      drawLine(halfHStabSpan, hStabY + hStabChord, 0, hStabY + hStabChord); // TE
      drawLine(0, hStabY + hStabChord, 0, hStabY); // Root

      // --- Draw Vertical Stabilizer ---
      // Draw it slightly offset or below the horizontal stab so they don't overlap in the template
      // We'll draw it below the aircraft total length, effectively extending the drawing height a bit
      const vStabY = heightMm + 20; // 20mm padding below the rest of the plane
      const vStabChord = dims.vStabChord * scaleToMm;
      const vStabSpanMm = dims.vStabSpan * scaleToMm;

      // Draw V-Stab (Root on X=0)
      drawLine(0, vStabY, vStabChord, vStabY); // Root chord
      drawLine(vStabChord, vStabY, vStabChord, vStabY + vStabSpanMm); // Span/TE
      drawLine(vStabChord, vStabY + vStabSpanMm, 0, vStabY + vStabSpanMm); // Tip
      drawLine(0, vStabY + vStabSpanMm, 0, vStabY); // LE

      // --- Draw Fuselage Profile ---
      const fuselageY = vStabY + vStabSpanMm + 20; // Below V-Stab
      const fuselageLengthMm = dims.fuselageLength * scaleToMm;
      // Since it's a basic profile, let's draw a simple rectangle for the top half
      // Assuming a width of 50mm for the template reference
      const fuselageWidthMm = 50;

      drawLine(0, fuselageY, fuselageWidthMm, fuselageY); // Top
      drawLine(fuselageWidthMm, fuselageY, fuselageWidthMm, fuselageY + fuselageLengthMm); // Side
      drawLine(fuselageWidthMm, fuselageY + fuselageLengthMm, 0, fuselageY + fuselageLengthMm); // Bottom
      drawLine(0, fuselageY + fuselageLengthMm, 0, fuselageY); // Centerline edge

      // --- Draw Centerline ---
      doc.setDrawColor(255, 0, 0); // Red dashed centerline
      doc.setLineDashPattern([5, 5], 0);
      drawLine(0, 0, 0, totalDrawingHeightMm);
      doc.setLineDashPattern([], 0); // reset

      // Restore black for labels
      doc.setDrawColor(0, 0, 0);
    }
  }

  doc.save('aerobuilder-templates.pdf');
}