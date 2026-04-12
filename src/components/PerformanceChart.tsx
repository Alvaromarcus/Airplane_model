import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { AircraftMetrics } from '../utils/calculations';

interface PerformanceChartProps {
  metrics: AircraftMetrics;
  unit: 'cm' | 'mm';
  isDarkMode: boolean;
}

export default function PerformanceChart({ metrics, isDarkMode }: PerformanceChartProps) {
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

      // === Mini Horizontal Bars ===
      const barMetrics = [
        {
          labelKey: 'chart_vbar_label',
          value: metrics.tailVolumeCoefficient,
          min: 0, max: 0.8,
          idealMin: 0.35, idealMax: 0.55,
        },
        {
          labelKey: 'chart_hstab_label',
          value: metrics.hStabArea / metrics.wingArea,
          min: 0, max: 0.5,
          idealMin: 0.15, idealMax: 0.30,
        },
        {
          labelKey: 'chart_ar_label',
          value: metrics.aspectRatio,
          min: 0, max: 12,
          idealMin: 4.5, idealMax: 8.0,
        },
      ];

      const padding = { top: 90, left: 10, right: 60, bottom: 10 };
      const rowHeight = 32;        // px per metric row
      const barHeight = 12;        // px height of the bar itself
      const labelFontSize = 11;
      const valueFontSize = 11;
      const barTop = (rowIndex: number) => padding.top + rowIndex * rowHeight + labelFontSize + 4;
      const barLeft = padding.left;
      const barWidth = w - padding.left - padding.right;

      barMetrics.forEach((m, i) => {
        // 1. Draw label text
        ctx.font = `${labelFontSize}px sans-serif`;
        ctx.fillStyle = isDarkMode ? '#d1d5db' : '#374151';
        ctx.textAlign = 'left';
        ctx.fillText(t(m.labelKey), barLeft, padding.top + i * rowHeight + labelFontSize);

        // 2. Draw background bar
        ctx.fillStyle = isDarkMode ? '#374151' : '#e5e7eb';
        ctx.fillRect(barLeft, barTop(i), barWidth, barHeight);

        // 3. Compute normalized fill width
        const clampedValue = Math.min(Math.max(m.value, m.min), m.max);
        const fillRatio = (clampedValue - m.min) / (m.max - m.min);
        const fillWidth = fillRatio * barWidth;

        // 4. Choose bar color
        const inIdeal = m.value >= m.idealMin && m.value <= m.idealMax;
        const nearIdeal = m.value >= m.idealMin * 0.7 && m.value <= m.idealMax * 1.3;
        const barColor = inIdeal ? '#22c55e' : nearIdeal ? '#f59e0b' : '#ef4444';
        ctx.fillStyle = barColor;
        ctx.fillRect(barLeft, barTop(i), fillWidth, barHeight);

        // 5. Draw ideal range tick marks
        const idealMinX = barLeft + ((m.idealMin - m.min) / (m.max - m.min)) * barWidth;
        const idealMaxX = barLeft + ((m.idealMax - m.min) / (m.max - m.min)) * barWidth;
        ctx.strokeStyle = isDarkMode ? '#9ca3af' : '#6b7280';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(idealMinX, barTop(i) - 2);
        ctx.lineTo(idealMinX, barTop(i) + barHeight + 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(idealMaxX, barTop(i) - 2);
        ctx.lineTo(idealMaxX, barTop(i) + barHeight + 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 6. Draw value text
        ctx.font = `${valueFontSize}px sans-serif`;
        ctx.fillStyle = barColor;
        ctx.textAlign = 'left';
        ctx.fillText(
          m.value.toFixed(2),
          barLeft + barWidth + 4,
          barTop(i) + barHeight / 2 + 4
        );
      });

    };

    draw();

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(draw);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [metrics, t, isDarkMode]);

  return (
    <div ref={containerRef} className="w-full" style={{ height: '220px' }}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
