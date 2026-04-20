import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftDimensions, AircraftMetrics, AircraftType, FuselageType } from '../utils/calculations';

interface CanvasViewProps {
  dimensions: AircraftDimensions;
  metrics: AircraftMetrics;
  isDarkMode: boolean;
  aircraftType: AircraftType;
  unit: 'cm' | 'mm';
  fuselageStyle?: FuselageType;
}

export default function CanvasView({ dimensions, metrics, isDarkMode, aircraftType, fuselageStyle = 'trainer' }: CanvasViewProps) {
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

      const tipYOffset = (dims.wingspan / 2) * Math.tan(dims.dihedral * Math.PI / 180);
      const frontViewBoxHeight = tipYOffset + 20;
      const frontViewBoxWidth = dims.wingspan;

      const totalRequiredHeight = topViewBoxHeight + sideViewBoxHeight + frontViewBoxHeight + 100; // padding between views
      const totalRequiredWidth = Math.max(topViewBoxWidth, sideViewBoxWidth, frontViewBoxWidth);

      // Padding around the canvas
      const paddingPixels = 40;
      const availableWidth = canvas.width - paddingPixels * 2;
      const availableHeight = canvas.height - paddingPixels * 2;

      const scaleX = availableWidth / totalRequiredWidth;
      const scaleY = availableHeight / totalRequiredHeight;
      const scale = Math.min(scaleX, scaleY);

      const cx = canvas.width / 2;

      // Top View Center Y
      const topCy = paddingPixels + (topViewBoxHeight * scale) / 2;

      ctx.save();

      // --- DRAW TOP VIEW ---
      ctx.translate(cx, topCy - (maxAircraftLength * scale) / 2);

      // Define colors based on theme
      const colors = {
        gridLine: isDarkMode ? '#374151' : '#e5e7eb', // gray-700 : gray-200
        fuselageFill: isDarkMode ? '#4b5563' : '#f3f4f6', // gray-600 : gray-100
        fuselageStroke: isDarkMode ? '#9ca3af' : '#6b7280', // gray-400 : gray-500
        wingFill: isDarkMode ? '#0369a1' : '#e0f2fe', // sky-700 : sky-100
        wingStroke: isDarkMode ? '#38bdf8' : '#0284c7', // sky-400 : sky-600
        hStabFill: isDarkMode ? '#be185d' : '#fce7f3', // pink-700 : pink-100
        hStabStroke: isDarkMode ? '#f472b6' : '#db2777', // pink-400 : pink-600
        vStabFill: isDarkMode ? '#a16207' : '#fef08a', // yellow-700 : yellow-200
        vStabStroke: isDarkMode ? '#fde047' : '#ca8a04', // yellow-400 : yellow-600
        text: isDarkMode ? '#d1d5db' : '#374151', // gray-300 : gray-700
      };

      // Draw Grid / Centerline
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, maxAircraftLength * scale);
      ctx.strokeStyle = colors.gridLine;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      const wingY = dims.noseLength * scale;

      // Draw Fuselage / Nacelle
      ctx.fillStyle = colors.fuselageFill;
      ctx.strokeStyle = colors.fuselageStroke;
      ctx.lineWidth = 2;

      if (aircraftType === 'flying_wing') {
        const nacelleWidth = 10;
        const nacelleLength = (dims.rootChord * 0.6) * scale;
        const nacelleX = -nacelleWidth / 2;
        const nacelleY = wingY + (dims.rootChord * 0.2) * scale;
        ctx.fillRect(nacelleX, nacelleY, nacelleWidth, nacelleLength);
        ctx.strokeRect(nacelleX, nacelleY, nacelleWidth, nacelleLength);
      } else {
        const isSport = fuselageStyle === 'sport';
        const wFront = isSport ? 14 / 2 : 14 / 2;
        const wTail = (14 * 0.3) / 2;
        const noseY = 0;
        const wingLeY = dims.noseLength * scale;
        const wingTeY = wingY + (dims.rootChord * scale);
        const tailY = dims.fuselageLength * scale;

        ctx.beginPath();
        if (isSport) {
           // Pointed nose, widens to canopy, then tapers
           ctx.moveTo(0, noseY);
           ctx.lineTo(wFront * 1.2, wingLeY * 0.5); // widest at canopy
           ctx.lineTo(wFront, wingTeY);
           ctx.lineTo(wTail, tailY);
           ctx.lineTo(-wTail, tailY);
           ctx.lineTo(-wFront, wingTeY);
           ctx.lineTo(-wFront * 1.2, wingLeY * 0.5);
        } else {
           // Flat boxy nose
           ctx.moveTo(-wFront, noseY);
           ctx.lineTo(wFront, noseY);
           ctx.lineTo(wFront, wingTeY);
           ctx.lineTo(wTail, tailY);
           ctx.lineTo(-wTail, tailY);
           ctx.lineTo(-wFront, wingTeY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Draw Wing
      ctx.fillStyle = colors.wingFill;
      ctx.strokeStyle = colors.wingStroke;

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

      if (aircraftType === 'flying_wing') {
        // Draw elevon hint: dashed line along the trailing edge at 75% span
        const elevonStartX = (dims.wingspan * 0.35 / 2) * scale;
        const elevonEndX   = (dims.wingspan / 2) * scale;
        // TE of right wing at elevonStartX:
        const teYAtStart = wingY + (dims.rootChord * scale)
                           + (dims.sweepOffset * scale * (elevonStartX / ((dims.wingspan/2)*scale)));
        // (approximate linear interpolation along TE)
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isDarkMode ? '#60a5fa' : '#2563eb';
        ctx.lineWidth = 1.5;
        // Right elevon
        ctx.beginPath();
        ctx.moveTo(elevonStartX, teYAtStart - (dims.tipChord * 0.25 * scale));
        ctx.lineTo(elevonEndX,
          wingY + (dims.sweepOffset * scale) + (dims.tipChord * scale) - (dims.tipChord * 0.25 * scale));
        ctx.stroke();
        // Left elevon (mirror)
        ctx.beginPath();
        ctx.moveTo(-elevonStartX, teYAtStart - (dims.tipChord * 0.25 * scale));
        ctx.lineTo(-elevonEndX,
          wingY + (dims.sweepOffset * scale) + (dims.tipChord * scale) - (dims.tipChord * 0.25 * scale));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else {
        // Draw Aileron hint: dashed line
        const aileronStartX = (dims.wingspan * 0.5 / 2) * scale;
        const aileronEndX   = (dims.wingspan * 0.95 / 2) * scale;
        
        const spanFractionStart = aileronStartX / ((dims.wingspan / 2) * scale);
        const spanFractionEnd = aileronEndX / ((dims.wingspan / 2) * scale);

        const teYAtStart = wingY + (dims.rootChord * scale) + spanFractionStart * (dims.sweepOffset * scale + dims.tipChord * scale - dims.rootChord * scale);
        const teYAtEnd = wingY + (dims.rootChord * scale) + spanFractionEnd * (dims.sweepOffset * scale + dims.tipChord * scale - dims.rootChord * scale);

        const localChordStart = (dims.rootChord * scale) + spanFractionStart * (dims.tipChord * scale - dims.rootChord * scale);
        const localChordEnd = (dims.rootChord * scale) + spanFractionEnd * (dims.tipChord * scale - dims.rootChord * scale);

        const hingeYStart = teYAtStart - localChordStart * 0.25;
        const hingeYEnd = teYAtEnd - localChordEnd * 0.25;

        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isDarkMode ? '#60a5fa' : '#2563eb';
        ctx.lineWidth = 1.5;
        // Right aileron
        ctx.beginPath();
        ctx.moveTo(aileronStartX, teYAtStart);
        ctx.lineTo(aileronStartX, hingeYStart);
        ctx.lineTo(aileronEndX, hingeYEnd);
        ctx.lineTo(aileronEndX, teYAtEnd);
        ctx.stroke();

        // Left aileron (mirror)
        ctx.beginPath();
        ctx.moveTo(-aileronStartX, teYAtStart);
        ctx.lineTo(-aileronStartX, hingeYStart);
        ctx.lineTo(-aileronEndX, hingeYEnd);
        ctx.lineTo(-aileronEndX, teYAtEnd);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();

        // Draw Horizontal Stabilizer
        const hStabY = wingY + (dims.rootChord * scale) + (dims.wingToTailDistance * scale);
        ctx.fillStyle = colors.hStabFill;
        ctx.strokeStyle = colors.hStabStroke;

        ctx.beginPath();
        ctx.rect(
          -(dims.hStabSpan / 2) * scale,
          hStabY,
          dims.hStabSpan * scale,
          dims.hStabChord * scale
        );
        ctx.fill();
        ctx.stroke();

        // Draw Elevator hint: dashed line
        const elevatorHingeY = hStabY + dims.hStabChord * scale * 0.7;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isDarkMode ? '#f472b6' : '#db2777'; // hStabStroke
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-(dims.hStabSpan / 2) * scale, elevatorHingeY);
        ctx.lineTo((dims.hStabSpan / 2) * scale, elevatorHingeY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Draw Theoretical CG (Top View)
      const cgY = (dims.noseLength + metrics.cgPosition) * scale;
      drawCGCircle(ctx, 0, cgY, 6);

      // Draw Neutral Point (NP)
      const npY = (dims.noseLength + metrics.neutralPoint) * scale;
      drawNPMarker(ctx, 0, npY, 6);

      ctx.restore();

      // --- DRAW SIDE VIEW ---
      const sideCy = paddingPixels + topViewBoxHeight * scale + 40;
      ctx.save();
      ctx.translate(cx, sideCy);

      // Fuselage Side Profile (simple rectangle for now)
      const fuselageHeightSide = 14;
      ctx.fillStyle = colors.fuselageFill;
      ctx.strokeStyle = colors.fuselageStroke;
      if (aircraftType === 'flying_wing') {
        const nacelleH = 10;
        const nacelleW = (dims.rootChord * 0.6) * scale;
        const nacelleStartX = -(maxAircraftLength * scale) / 2
                              + (dims.noseLength * scale)
                              + (dims.rootChord * 0.2) * scale;
        ctx.fillRect(nacelleStartX, 0, nacelleW, nacelleH);
        ctx.strokeRect(nacelleStartX, 0, nacelleW, nacelleH);
      } else {
        const isSport = fuselageStyle === 'sport';
        const noseX = -(maxAircraftLength * scale) / 2;
        const wingLeX = noseX + (dims.noseLength) * scale;
        const wingTeX = noseX + (dims.noseLength + dims.rootChord) * scale;
        const tailX = noseX + dims.fuselageLength * scale;
        
        const hFront = fuselageHeightSide * (isSport ? 1.2 : 1.0);
        const hTail = fuselageHeightSide * 0.6;
        const tailYStart = (hFront - hTail) / 2;
        
        ctx.beginPath();
        if (isSport) {
           // Bubble canopy profile
           ctx.moveTo(noseX, hFront * 0.6); // Pointed nose center
           ctx.lineTo(noseX + (dims.noseLength * scale * 0.2), hFront * 0.8); // bottom contour
           ctx.lineTo(wingTeX, hFront); // flat bottom under wing
           ctx.lineTo(tailX, hFront - tailYStart); // taper to tail
           ctx.lineTo(tailX, tailYStart); // tail top
           ctx.lineTo(wingTeX, 0); // taper back up
           // Canopy bubble
           ctx.quadraticCurveTo(wingLeX * 0.8, -hFront * 0.2, noseX, hFront * 0.6);
        } else {
           // Trainer profile
           ctx.moveTo(noseX, 0);
           ctx.lineTo(noseX, hFront);
           ctx.lineTo(wingTeX, hFront);
           ctx.lineTo(tailX, hFront - tailYStart);
           ctx.lineTo(tailX, tailYStart);
           ctx.lineTo(wingTeX, 0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Vertical Stabilizer
      ctx.fillStyle = colors.vStabFill;
      ctx.strokeStyle = colors.vStabStroke;

      if (aircraftType === 'flying_wing') {
        const wingletRootX = -(maxAircraftLength * scale) / 2 + (dims.noseLength + dims.sweepOffset) * scale;
        const rootC = dims.vStabChord * scale;
        const tipC = dims.vStabChord * 0.4 * scale;
        const spanH = dims.vStabSpan * scale;
        const sweepW = dims.vStabChord * 0.6 * scale;

        const startY = spanH * 0.2; // 20% below the wing

        ctx.beginPath();
        ctx.moveTo(wingletRootX, startY);
        ctx.lineTo(wingletRootX + sweepW, startY - spanH);
        ctx.lineTo(wingletRootX + sweepW + tipC, startY - spanH);
        ctx.lineTo(wingletRootX + rootC, startY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        // Align with the back of the fuselage
        const vStabX = -(maxAircraftLength * scale) / 2 + (dims.fuselageLength * scale) - (dims.vStabChord * scale);

        ctx.beginPath();
        ctx.moveTo(vStabX, 0);
        ctx.lineTo(vStabX, -dims.vStabSpan * scale);
        ctx.lineTo(vStabX + (dims.vStabChord * scale), -dims.vStabSpan * scale);
        ctx.lineTo(vStabX + (dims.vStabChord * scale), 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw Rudder hint: dashed line
        const rudderHingeX = vStabX + dims.vStabChord * scale * 0.6;
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = isDarkMode ? '#fde047' : '#ca8a04'; // vStabStroke
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rudderHingeX, 0);
        ctx.lineTo(rudderHingeX, -dims.vStabSpan * scale);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Horizontal Stabilizer (Side view representation)
        const hStabY = wingY + (dims.rootChord * scale) + (dims.wingToTailDistance * scale);
        ctx.fillStyle = colors.hStabFill;
        ctx.strokeStyle = colors.hStabStroke;
        const hStabSideX = -(maxAircraftLength * scale) / 2 + hStabY;
        ctx.fillRect(hStabSideX, fuselageHeightSide / 2 - 2, dims.hStabChord * scale, 4);
        ctx.strokeRect(hStabSideX, fuselageHeightSide / 2 - 2, dims.hStabChord * scale, 4);
      }

      // Wing position indicator on fuselage (Enhanced profile)
      const wingSideX = -(maxAircraftLength * scale) / 2 + wingY;
      ctx.fillStyle = colors.wingFill;
      ctx.strokeStyle = colors.wingStroke;
      ctx.beginPath();
      ctx.moveTo(wingSideX, 0);
      ctx.quadraticCurveTo(wingSideX + (dims.rootChord * scale) * 0.25, -6, wingSideX + (dims.rootChord * scale), 0);
      ctx.fill();
      ctx.stroke();

      // CG on side view
      const cgSideX = -(maxAircraftLength * scale) / 2 + cgY;
      drawCGCircle(ctx, cgSideX, fuselageHeightSide / 2, 6);

      ctx.restore();

      // --- DRAW FRONT VIEW ---
      const frontCy = sideCy + sideViewBoxHeight * scale + 40;
      ctx.save();
      ctx.translate(cx, frontCy);

      // Fuselage Front Profile
      const fuselageWidthFront = 12;
      const fuselageHeightFront = 12;
      ctx.fillStyle = colors.fuselageFill;
      ctx.strokeStyle = colors.fuselageStroke;
      ctx.fillRect(
        -fuselageWidthFront / 2,
        0,
        fuselageWidthFront,
        fuselageHeightFront
      );
      ctx.strokeRect(
        -fuselageWidthFront / 2,
        0,
        fuselageWidthFront,
        fuselageHeightFront
      );

      // Vertical Stabilizer Front Profile
      ctx.fillStyle = colors.vStabFill;
      ctx.strokeStyle = colors.vStabStroke;

      if (aircraftType === 'flying_wing') {
        const tipX = (dims.wingspan / 2) * scale;
        const tipY = fuselageHeightFront / 2 - (tipYOffset * scale);
        const spanH = dims.vStabSpan * scale;
        const wingletW = 3;
        const startY = spanH * 0.2; // 20% below wing

        // Right winglet
        ctx.fillRect(tipX - wingletW / 2, tipY - spanH + startY, wingletW, spanH);
        ctx.strokeRect(tipX - wingletW / 2, tipY - spanH + startY, wingletW, spanH);

        // Left winglet
        ctx.fillRect(-tipX - wingletW / 2, tipY - spanH + startY, wingletW, spanH);
        ctx.strokeRect(-tipX - wingletW / 2, tipY - spanH + startY, wingletW, spanH);
      } else {
        const vStabWidthFront = 4;
        ctx.fillRect(
          -vStabWidthFront / 2,
          -dims.vStabSpan * scale,
          vStabWidthFront,
          dims.vStabSpan * scale
        );
        ctx.strokeRect(
          -vStabWidthFront / 2,
          -dims.vStabSpan * scale,
          vStabWidthFront,
          dims.vStabSpan * scale
        );
      }

      // Wing Dihedral Front Profile
      ctx.strokeStyle = colors.wingStroke;
      ctx.lineWidth = 3;
      ctx.beginPath();

      // Right Wing
      ctx.moveTo(fuselageWidthFront / 2, fuselageHeightFront / 2);
      ctx.lineTo((dims.wingspan / 2) * scale, fuselageHeightFront / 2 - (tipYOffset * scale));

      // Left Wing
      ctx.moveTo(-fuselageWidthFront / 2, fuselageHeightFront / 2);
      ctx.lineTo(-(dims.wingspan / 2) * scale, fuselageHeightFront / 2 - (tipYOffset * scale));

      ctx.stroke();
      ctx.lineWidth = 1; // reset

      ctx.restore();

      // Draw labels
      ctx.font = '14px sans-serif';
      ctx.fillStyle = colors.text;
      ctx.fillText(t('top_view'), 40, 40);
      ctx.fillText(t('side_view'), 40, sideCy - 20);
      ctx.fillText(t('front_view'), 40, frontCy - 20);

      // --- LEGEND ---
      const legendX = 10;
      const legendY = canvas.height - 70;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = colors.text;
      ctx.fillText(t('legend') ?? 'Legend', legendX, legendY);

      // CG symbol
      drawCGCircle(ctx, legendX + 6, legendY + 14, 6);
      ctx.fillStyle = colors.text;
      ctx.font = '10px sans-serif';
      ctx.fillText('CG', legendX + 16, legendY + 18);

      // NP symbol
      drawNPMarker(ctx, legendX + 6, legendY + 32, 6);
      ctx.fillStyle = colors.text;
      ctx.fillText('NP', legendX + 16, legendY + 36);
    };

    const drawCGCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
      ctx.save();
      ctx.translate(x, y);

      // Outer circle
      ctx.beginPath();
      ctx.strokeStyle = isDarkMode ? 'white' : 'black';
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Quadrants
      ctx.fillStyle = isDarkMode ? 'white' : 'black';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, 0, Math.PI / 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, Math.PI, Math.PI * 1.5);
      ctx.fill();

      ctx.fillStyle = isDarkMode ? 'black' : 'white';
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

    const drawNPMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.save();
      ctx.translate(x, y);

      // Downward-pointing triangle for NP
      ctx.beginPath();
      ctx.fillStyle = '#f97316'; // orange-500
      ctx.moveTo(0, size);
      ctx.lineTo(-size, -size);
      ctx.lineTo(size, -size);
      ctx.closePath();
      ctx.fill();

      // NP Label
      ctx.font = '10px sans-serif';
      ctx.fillStyle = isDarkMode ? '#d1d5db' : '#374151'; // matches colors.text
      ctx.fillText('NP', size + 4, size / 2);

      ctx.restore();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial draw

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [dimensions, metrics, t, isDarkMode, aircraftType]);

  return (
    <div ref={containerRef} className="w-full h-full absolute inset-0">
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
