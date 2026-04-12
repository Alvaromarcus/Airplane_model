import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftMetrics } from '../utils/calculations';

interface PerformanceChartProps {
  metrics: AircraftMetrics;
  unit: 'cm' | 'mm';
}

export default function PerformanceChart({ metrics }: PerformanceChartProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // Title
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#111827';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(t('chart_title'), 10, 20);

      const PADDING = 20;
      const BAR_W = w - PADDING * 2;
      const BAR_X = PADDING;

      // === Static Margin Horizontal Bar ===
      const SM_Y = 50;
      const SM_H = 20;
      const smValue = metrics.staticMargin;

      // Regions: < 5, 5-20, > 20
      // Let's map -10% to 40% SM across the bar (range 50)
      const SM_MIN = -10;
      const SM_MAX = 40;
      const smToX = (sm: number) => {
        const clamped = Math.max(SM_MIN, Math.min(SM_MAX, sm));
        return BAR_X + ((clamped - SM_MIN) / (SM_MAX - SM_MIN)) * BAR_W;
      };

      const x5 = smToX(5);
      const x20 = smToX(20);

      // Draw Unstable (Red)
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.fillRect(BAR_X, SM_Y, x5 - BAR_X, SM_H);

      // Draw Ideal (Green)
      ctx.fillStyle = '#22c55e'; // green-500
      ctx.fillRect(x5, SM_Y, x20 - x5, SM_H);

      // Draw Sluggish (Amber)
      ctx.fillStyle = '#f59e0b'; // amber-500
      ctx.fillRect(x20, SM_Y, (BAR_X + BAR_W) - x20, SM_H);

      // SM Labels
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('chart_unstable'), BAR_X + (x5 - BAR_X) / 2, SM_Y + 14);
      ctx.fillText(t('chart_ideal'), x5 + (x20 - x5) / 2, SM_Y + 14);
      ctx.fillText(t('chart_sluggish'), x20 + ((BAR_X + BAR_W) - x20) / 2, SM_Y + 14);

      // SM Marker
      const smMarkerX = smToX(smValue);
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000';
      ctx.beginPath();
      ctx.moveTo(smMarkerX, SM_Y - 5);
      ctx.lineTo(smMarkerX - 5, SM_Y - 15);
      ctx.lineTo(smMarkerX + 5, SM_Y - 15);
      ctx.fill();

      ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#111827';
      ctx.fillText(`${t('chart_sm_label')}: ${smValue.toFixed(1)}%`, smMarkerX, SM_Y - 18);

      // === Mini Vertical Bars ===
      const MINI_Y = 110;
      const MINI_H = 40;
      const numBars = 3;
      const spacing = 15;
      const miniW = (BAR_W - (numBars - 1) * spacing) / numBars;

      const drawMiniBar = (index: number, label: string, value: number, minIdeal: number, maxIdeal: number, rangeMin: number, rangeMax: number) => {
        const x = BAR_X + index * (miniW + spacing);

        // Background
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb';
        ctx.fillRect(x, MINI_Y, miniW, MINI_H);

        // Normalize value
        const norm = Math.max(0, Math.min(1, (value - rangeMin) / (rangeMax - rangeMin)));
        const fillW = norm * miniW;

        // Color based on ideal
        const isIdeal = value >= minIdeal && value <= maxIdeal;
        const isSlightlyOff = (value >= minIdeal * 0.8 && value <= maxIdeal * 1.2) && !isIdeal;

        if (isIdeal) ctx.fillStyle = '#22c55e'; // green
        else if (isSlightlyOff) ctx.fillStyle = '#f59e0b'; // amber
        else ctx.fillStyle = '#ef4444'; // red

        ctx.fillRect(x, MINI_Y, fillW, MINI_H);

        // Ideal bounds ticks
        const t1X = x + ((minIdeal - rangeMin) / (rangeMax - rangeMin)) * miniW;
        const t2X = x + ((maxIdeal - rangeMin) / (rangeMax - rangeMin)) * miniW;

        ctx.fillStyle = '#000000';
        ctx.fillRect(t1X, MINI_Y, 2, MINI_H);
        ctx.fillRect(t2X, MINI_Y, 2, MINI_H);

        // Label
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#4b5563';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, x, MINI_Y - 5);
        ctx.textAlign = 'right';
        ctx.fillText(value.toFixed(2), x + miniW, MINI_Y - 5);
      };

      const hStabRatio = metrics.hStabArea / metrics.wingArea;

      // 1. Tail Volume
      drawMiniBar(0, t('chart_vbar_label'), metrics.tailVolumeCoefficient, 0.35, 0.55, 0, 1);
      // 2. HStab Ratio
      drawMiniBar(1, t('chart_hstab_label'), hStabRatio, 0.15, 0.30, 0, 0.5);
      // 3. Aspect Ratio
      drawMiniBar(2, t('chart_ar_label'), metrics.aspectRatio, 4.5, 8.0, 2, 12);

    };

    draw();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(draw);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [metrics, t]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: '180px' }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
