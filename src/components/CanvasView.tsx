import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftDimensions, AircraftMetrics } from '../utils/calculations';

interface CanvasViewProps {
  dimensions: AircraftDimensions;
  metrics: AircraftMetrics;
}

export default function CanvasView({ dimensions, metrics }: CanvasViewProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const dims = dimensions;

      // Calculate drawing scale to fit in canvas
      // We need to fit two views: Top view (top half) and Side view (bottom half)
      const maxAircraftLength = Math.max(
        dims.fuselageLength,
        dims.noseLength + dims.rootChord + dims.wingToTailDistance + dims.hStabChord
      );
      const maxAircraftWidth = dims.wingspan;

      const topViewBoxHeight = maxAircraftLength;
      const topViewBoxWidth = maxAircraftWidth;

      const sideViewBoxHeight = dims.vStabSpan + 20; // arbitrary height for side view
      const sideViewBoxWidth = maxAircraftLength;

      const totalRequiredHeight = topViewBoxHeight + sideViewBoxHeight + 50; // 50px padding between views
      const totalRequiredWidth = Math.max(topViewBoxWidth, sideViewBoxWidth);

      // Padding around the canvas
      const padding = 40;
      const availableWidth = canvas.width - padding * 2;
      const availableHeight = canvas.height - padding * 2;

      const scaleX = availableWidth / totalRequiredWidth;
      const scaleY = availableHeight / totalRequiredHeight;
      const scale = Math.min(scaleX, scaleY);

      const cx = canvas.width / 2;

      // Top View Center Y
      const topCy = padding + (topViewBoxHeight * scale) / 2;

      ctx.save();

      // --- DRAW TOP VIEW ---
      ctx.translate(cx, topCy - (maxAircraftLength * scale) / 2);

      // Draw Grid / Centerline
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, maxAircraftLength * scale);
      ctx.strokeStyle = '#e5e7eb'; // gray-200
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Fuselage
      ctx.fillStyle = '#f3f4f6'; // gray-100
      ctx.strokeStyle = '#6b7280'; // gray-500
      ctx.lineWidth = 2;
      const fuselageWidthScale = 10 * scale; // Assume constant 10 unit width for fuselage visual
      ctx.fillRect(-fuselageWidthScale / 2, 0, fuselageWidthScale, dims.fuselageLength * scale);
      ctx.strokeRect(-fuselageWidthScale / 2, 0, fuselageWidthScale, dims.fuselageLength * scale);

      // Draw Wing
      const wingY = dims.noseLength * scale;
      ctx.fillStyle = '#e0f2fe'; // sky-100
      ctx.strokeStyle = '#0284c7'; // sky-600

      ctx.beginPath();
      // Right Wing
      ctx.moveTo(0, wingY); // Root LE
      ctx.lineTo((dims.wingspan / 2) * scale, wingY + (dims.sweepOffset * scale)); // Tip LE
      ctx.lineTo((dims.wingspan / 2) * scale, wingY + (dims.sweepOffset * scale) + (dims.tipChord * scale)); // Tip TE
      ctx.lineTo(0, wingY + (dims.rootChord * scale)); // Root TE
      // Left Wing
      ctx.lineTo(-(dims.wingspan / 2) * scale, wingY + (dims.sweepOffset * scale) + (dims.tipChord * scale)); // Tip TE
      ctx.lineTo(-(dims.wingspan / 2) * scale, wingY + (dims.sweepOffset * scale)); // Tip LE
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw Horizontal Stabilizer
      const hStabY = wingY + (dims.rootChord * scale) + (dims.wingToTailDistance * scale);
      ctx.fillStyle = '#fce7f3'; // pink-100
      ctx.strokeStyle = '#db2777'; // pink-600

      ctx.beginPath();
      ctx.rect(
        -(dims.hStabSpan / 2) * scale,
        hStabY,
        dims.hStabSpan * scale,
        dims.hStabChord * scale
      );
      ctx.fill();
      ctx.stroke();

      // Draw Theoretical CG (Top View)
      const cgY = (dims.noseLength + metrics.cgPosition) * scale;
      drawCGCircle(ctx, 0, cgY, 6);

      ctx.restore();

      // --- DRAW SIDE VIEW ---
      const sideCy = padding + topViewBoxHeight * scale + 50;
      ctx.save();
      ctx.translate(cx, sideCy);

      // Fuselage Side Profile (simple rectangle for now)
      const fuselageHeightSide = 10 * scale;
      ctx.fillStyle = '#f3f4f6';
      ctx.strokeStyle = '#6b7280';
      ctx.fillRect(
        -(maxAircraftLength * scale) / 2,
        0,
        dims.fuselageLength * scale,
        fuselageHeightSide
      );
      ctx.strokeRect(
        -(maxAircraftLength * scale) / 2,
        0,
        dims.fuselageLength * scale,
        fuselageHeightSide
      );

      // Vertical Stabilizer
      ctx.fillStyle = '#fef08a'; // yellow-200
      ctx.strokeStyle = '#ca8a04'; // yellow-600
      const vStabX = -(maxAircraftLength * scale) / 2 + hStabY; // align with HStab

      ctx.beginPath();
      ctx.moveTo(vStabX, 0);
      ctx.lineTo(vStabX, -dims.vStabSpan * scale);
      ctx.lineTo(vStabX + (dims.vStabChord * scale), -dims.vStabSpan * scale);
      ctx.lineTo(vStabX + (dims.vStabChord * scale), 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing position indicator on fuselage
      const wingSideX = -(maxAircraftLength * scale) / 2 + wingY;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(wingSideX, -2, dims.rootChord * scale, 4);

      // CG on side view
      const cgSideX = -(maxAircraftLength * scale) / 2 + cgY;
      drawCGCircle(ctx, cgSideX, fuselageHeightSide / 2, 6);

      ctx.restore();

      // Draw labels
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#374151';
      ctx.fillText(t('top_view'), padding, padding);
      ctx.fillText(t('side_view'), padding, sideCy - 20);
    };

    const drawCGCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
      ctx.save();
      ctx.translate(x, y);

      // Outer circle
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Quadrants
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, 0, Math.PI / 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, Math.PI, Math.PI * 1.5);
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, Math.PI / 2, Math.PI);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, Math.PI * 1.5, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial draw

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [dimensions, metrics, t]);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
