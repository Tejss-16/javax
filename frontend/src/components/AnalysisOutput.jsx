// src/components/AnalysisOutput.jsx  (FIXED)
//
// CHANGES:
//   - Props changed: accepts `queryHistory` (array) + `loading` + `currentQuery`
//     instead of the old single `data` prop.
//   - Renders one labeled panel per entry in queryHistory, newest at the bottom
//     (matching the mockup — Query1 panel on top, Query2 panel below it).
//   - Each panel has a sticky query-label badge in the top-right corner,
//     matching the rough design in the screenshot.
//   - A loading skeleton panel appears at the bottom while a new query is running.
//   - All previous chart/scorecard/table content stays visible when a new query runs.

import React, { useState, useEffect, Component } from 'react';
import ReactDOM from 'react-dom';
import Plot from 'react-plotly.js';
import { TrendingUp, TrendingDown, Minus, Copy, Check, BarChart2, ArrowUpRight, Loader2, Maximize2, X } from 'lucide-react';

// ─────────────────────────────────────────────
// 1. THEME
// ─────────────────────────────────────────────

const THEME = {
  colors: {
    primary:     '#6366F1',
    line:        '#818CF8',
    area:        '#818CF8',
    bar:         '#6366F1',
    stacked_bar: '#6366F1',
    grouped_bar: '#6366F1',
    scatter:     '#A855F7',
    bubble:      '#A855F7',
    pie:         ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6', '#F97316', '#3B82F6', '#EF4444'],
    histogram:   '#38BDF8',
    funnel:      '#F59E0B',
    treemap:     ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6', '#F97316'],
    waterfall:   '#14B8A6',
    series:      ['#818CF8', '#34D399', '#FBBF24', '#F472B6', '#2DD4BF', '#FB923C', '#60A5FA', '#F87171'],
    box:         '#818CF8',
  },
  bg: {
    paper: 'rgba(17,24,39,0)',
    plot:  'rgba(17,24,39,0)',
  },
  font: {
    color:  '#E2E8F0',
    muted:  '#94A3B8',
    size:   { title: 15, axis: 11 },
  },
};

// ─────────────────────────────────────────────
// 2. SIZE MAP
// ─────────────────────────────────────────────

const SIZE_MAP = {
  small:  { gridSpan: 'lg:col-span-1', height: 300 },
  medium: { gridSpan: 'lg:col-span-1', height: 340 },
  large:  { gridSpan: 'lg:col-span-2', height: 420 },
};

function getSize(size) {
  return SIZE_MAP[size] ?? SIZE_MAP.medium;
}

// ─────────────────────────────────────────────
// 3. CHART VALIDATION
// ─────────────────────────────────────────────

const XY_TYPES = new Set(['line','area','bar','scatter','stacked_bar','grouped_bar','funnel','waterfall']);

function validateChart(chart) {
  if (!chart || typeof chart !== 'object') return 'Chart is null or not an object';
  if (!chart.type || typeof chart.type !== 'string') return 'Missing or invalid chart.type';
  const type = chart.type;

  if (type === 'not_possible') return null;

  if (type === 'histogram') {
    const vals = chart.values ?? chart.x;
    if (!Array.isArray(vals) || vals.length === 0) return 'histogram: values/x is empty or not an array';
    return null;
  }
  if (type === 'box') {
    const hasValues = Array.isArray(chart.values) && chart.values.length > 0;
    const hasGroups = Array.isArray(chart.groups) && chart.groups.length > 0 &&
                      chart.groups.every(g => Array.isArray(g.values) && g.values.length > 0);
    if (!hasValues && !hasGroups) return 'box: values or groups missing/empty';
    return null;
  }
  if (type === 'heatmap') {
    if (!Array.isArray(chart.x) || !Array.isArray(chart.y) || !Array.isArray(chart.z))
      return 'heatmap: x, y, or z missing';
    return null;
  }
  if (type === 'bubble') {
    if (!Array.isArray(chart.x) || !Array.isArray(chart.y)) return 'bubble: x or y missing';
    return null;
  }
  if (type === 'treemap') {
    if (!Array.isArray(chart.labels) || !Array.isArray(chart.values)) return 'treemap: labels or values missing';
    return null;
  }
  if (type === 'pie') {
    if (!Array.isArray(chart.x) || chart.x.length === 0) return 'pie: x is missing or empty';
    if (!Array.isArray(chart.y) || chart.y.length === 0) return 'pie: y is missing or empty';
    return null;
  }
  if (XY_TYPES.has(type)) {
    if (chart.series !== undefined) {
      if (!Array.isArray(chart.series) || chart.series.length === 0)
        return `${type}: series must be a non-empty array`;
      for (const [i, s] of chart.series.entries()) {
        if (!Array.isArray(s.x) || !Array.isArray(s.y))
          return `${type}: series[${i}] missing x or y array`;
        if (s.x.length === 0 || s.y.length === 0)
          return `${type}: series[${i}] x or y is empty`;
      }
      return null;
    }
    if (!Array.isArray(chart.x) || chart.x.length === 0) return `${type}: x is missing or empty`;
    if (!Array.isArray(chart.y) || chart.y.length === 0) return `${type}: y is missing or empty`;
    if (chart.x.length !== chart.y.length)
      return `${type}: x/y length mismatch (${chart.x.length} vs ${chart.y.length})`;
    return null;
  }
  return `Unsupported chart type: "${type}"`;
}

// ─────────────────────────────────────────────
// 4. ERROR BOUNDARY
// ─────────────────────────────────────────────

class ChartErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, message: '' }; }
  static getDerivedStateFromError(err) { return { hasError: true, message: err?.message ?? 'Unknown render error' }; }
  componentDidCatch(err, info) { console.error('[ChartErrorBoundary]', err, info); }
  render() {
    if (this.state.hasError)
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[160px] rounded-xl border border-red-500/30 bg-red-950/20 text-red-400 p-4 text-sm gap-2">
          <span className="font-semibold">Chart failed to render</span>
          <span className="text-red-500/70 text-xs font-mono">{this.state.message}</span>
        </div>
      );
    return this.props.children;
  }
}

// ─────────────────────────────────────────────
// 5. CHART SKELETON
// ─────────────────────────────────────────────

function ChartSkeleton({ height }) {
  return (
    <div className="rounded-2xl bg-white/5 animate-pulse flex items-end gap-2 px-6 pb-6 pt-4" style={{ height }}>
      {[45, 70, 55, 80, 60, 40, 75, 50].map((h, i) => (
        <div key={i} className="flex-1 rounded-sm bg-white/10" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 6. SCORECARD ROW
// ─────────────────────────────────────────────

const SCORECARD_ACCENTS = ['#818CF8', '#34D399', '#FBBF24', '#F472B6', '#2DD4BF'];

function ScorecardRow({ scorecards }) {
  if (!Array.isArray(scorecards) || scorecards.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
      {scorecards.map((card, i) => {
        const accent = SCORECARD_ACCENTS[i % SCORECARD_ACCENTS.length];
        return (
          <div
            key={i}
            className="relative rounded-2xl bg-[#0f172a] border border-white/8 px-5 py-4 flex flex-col gap-1 overflow-hidden shadow-lg"
            style={{ borderTop: `3px solid ${accent}` }}
          >
            <div
              className="absolute inset-0 opacity-5 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at 30% 30%, ${accent}, transparent 70%)` }}
            />
            <span className="text-[11px] text-slate-400 truncate font-medium tracking-wide">{card.label}</span>
            <span className="text-2xl font-black text-white tracking-tight" style={{ color: accent }}>
              {card.value}
            </span>
            <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">{card.aggregation}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// INSIGHT GENERATOR
// ─────────────────────────────────────────────

function generateInsight(chart) {
  try {
    const type = chart.type;

    if (type === 'line' || type === 'area') {
      const yArr = chart.series ? chart.series[0]?.y : chart.y;
      if (!Array.isArray(yArr) || yArr.length < 2) return null;
      const nums = yArr.map(Number).filter(v => !isNaN(v));
      if (nums.length < 2) return null;
      const first = nums.slice(0, Math.ceil(nums.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(nums.length / 3);
      const last  = nums.slice(-Math.ceil(nums.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(nums.length / 3);
      const pct   = ((last - first) / (Math.abs(first) || 1)) * 100;
      const dir   = pct > 5 ? 'upward' : pct < -5 ? 'downward' : 'relatively flat';
      const sign  = pct >= 0 ? '+' : '';
      return { text: `Overall trend is ${dir} (${sign}${pct.toFixed(1)}% from start to end).`, direction: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat' };
    }

    if (['bar', 'stacked_bar', 'grouped_bar', 'funnel', 'waterfall'].includes(type)) {
      const xArr = chart.series ? chart.series[0]?.x : chart.x;
      const yArr = chart.series ? chart.series[0]?.y : chart.y;
      if (!Array.isArray(xArr) || !Array.isArray(yArr) || xArr.length === 0) return null;
      const nums  = yArr.map(Number);
      const total = nums.reduce((a, b) => a + b, 0);
      const maxV  = Math.max(...nums);
      const maxI  = nums.indexOf(maxV);
      const share = total > 0 ? ((maxV / total) * 100).toFixed(1) : null;
      const label = xArr[maxI];
      return {
        text: share
          ? `"${label}" leads with ${fmtNum(maxV)} — ${share}% of the total.`
          : `"${label}" has the highest value at ${fmtNum(maxV)}.`,
        direction: 'neutral',
      };
    }

    if (type === 'histogram') {
      // Prefer pre-computed backend stats over client-side recalculation.
      // The backend payload (chart.stats) always exists for histograms in V2.
      const s = chart.stats;
      if (!s || typeof s.mean === 'undefined') return null;
    
      const parts = [];
    
      // Central tendency
      parts.push(`Mean ${fmtNum(s.mean)}, median ${fmtNum(s.median)}.`);
    
      // Skewness direction (only mention when notable: |skew| > 0.5)
      if (Math.abs(s.skewness) > 0.5) {
        const dir = s.skewness > 0 ? 'right (positive)' : 'left (negative)';
        parts.push(`Distribution is ${dir}-skewed.`);
      }
    
      // Outlier warning (only when meaningful: > 1% of rows)
      if (s.outlier_pct > 1) {
        parts.push(`${s.outlier_count} outlier${s.outlier_count !== 1 ? 's' : ''} (${s.outlier_pct}%) detected — axis zoomed to core range.`);
      }
    
      return { text: parts.join(' '), direction: 'neutral' };
    }

    if (type === 'box') {
      // For grouped boxes: report the highest and lowest median categories
      if (Array.isArray(chart.groups) && chart.groups.length > 1) {
        const stats = chart.groups.map(g => {
          const s = [...g.values].map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b);
          return { name: g.name, med: s[Math.floor(s.length * 0.5)] };
        }).filter(g => g.med != null).sort((a, b) => b.med - a.med);
        if (stats.length < 2) return null;
        return {
          text: `"${stats[0].name}" has the highest median (${fmtNum(stats[0].med)}); "${stats[stats.length - 1].name}" has the lowest (${fmtNum(stats[stats.length - 1].med)}).`,
          direction: 'neutral',
        };
      }
      // Single series fallback
      const sorted = [...(chart.values ?? [])].map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b);
      if (sorted.length === 0) return null;
      const q1  = sorted[Math.floor(sorted.length * 0.25)];
      const q3  = sorted[Math.floor(sorted.length * 0.75)];
      const med = sorted[Math.floor(sorted.length * 0.5)];
      return { text: `Median ${fmtNum(med)}, IQR ${fmtNum(q1)} – ${fmtNum(q3)}.`, direction: 'neutral' };
    }

    if (type === 'pie' || type === 'treemap') {
      const labels = type === 'pie' ? chart.x : chart.labels;
      const vals   = type === 'pie' ? chart.y : chart.values;
      if (!Array.isArray(labels) || !Array.isArray(vals)) return null;
      const nums  = vals.map(Number);
      const total = nums.reduce((a, b) => a + b, 0);
      const maxV  = Math.max(...nums);
      const maxI  = nums.indexOf(maxV);
      const share = total > 0 ? ((maxV / total) * 100).toFixed(1) : null;
      return {
        text: share ? `"${labels[maxI]}" dominates at ${share}% of the total.` : `"${labels[maxI]}" is the largest segment.`,
        direction: 'neutral',
      };
    }

    if (type === 'scatter' || type === 'bubble') {
      const xArr = chart.x.map(Number).filter(v => !isNaN(v));
      const yArr = chart.y.map(Number).filter(v => !isNaN(v));
      if (xArr.length < 3) return null;
      const n = Math.min(xArr.length, yArr.length);
      const mx = xArr.slice(0, n).reduce((a, b) => a + b, 0) / n;
      const my = yArr.slice(0, n).reduce((a, b) => a + b, 0) / n;
      let num = 0, dx2 = 0, dy2 = 0;
      for (let i = 0; i < n; i++) {
        num  += (xArr[i] - mx) * (yArr[i] - my);
        dx2  += (xArr[i] - mx) ** 2;
        dy2  += (yArr[i] - my) ** 2;
      }
      const r = num / (Math.sqrt(dx2 * dy2) || 1);
      const desc = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : 'weak';
      const dir  = r > 0 ? 'positive' : 'negative';
      return { text: `${desc.charAt(0).toUpperCase() + desc.slice(1)} ${dir} correlation (r ≈ ${r.toFixed(2)}).`, direction: r > 0.4 ? 'up' : r < -0.4 ? 'down' : 'flat' };
    }

    if (type === 'heatmap') {
      let maxV = -Infinity, maxRow = 0, maxCol = 0;
      chart.z.forEach((row, ri) => row.forEach((v, ci) => { if (v > maxV) { maxV = v; maxRow = ri; maxCol = ci; } }));
      return {
        text: `Peak value ${fmtNum(maxV)} at (${chart.y[maxRow]}, ${chart.x[maxCol]}).`,
        direction: 'neutral',
      };
    }

  } catch (_) { /* swallow */ }
  return null;
}

function fmtNum(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000)     return (v / 1_000).toFixed(1) + 'K';
  if (v !== Math.floor(v)) return v.toFixed(2);
  return v.toLocaleString();
}

// Return a "nice" round step for axis ticks given a rough target interval
function niceStep(rough) {
  if (!rough || !isFinite(rough) || rough <= 0) return null;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

function InsightBadge({ chart }) {
  const insight = generateInsight(chart);
  if (!insight) return null;

  const icons = { up: TrendingUp, down: TrendingDown, flat: Minus, neutral: BarChart2 };
  const colors = {
    up:      'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    down:    'text-red-400 bg-red-500/10 border-red-500/20',
    flat:    'text-slate-400 bg-white/5 border-white/10',
    neutral: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
  };
  const Icon  = icons[insight.direction] ?? BarChart2;
  const color = colors[insight.direction] ?? colors.neutral;

  return (
    <div className={`flex items-start gap-2 mt-3 px-3 py-2 rounded-xl border text-xs font-medium leading-snug ${color}`}>
      <Icon size={13} className="mt-0.5 flex-shrink-0" />
      <span>{insight.text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// CHART RENDERER (unchanged from original)
// ─────────────────────────────────────────────

function buildCommonLayout(chart, height) {
  return {
    height,
    autosize: true,
    title: {
      text: chart.title ?? '',
      font: { size: THEME.font.size.title, color: THEME.font.color, family: 'Inter, system-ui, sans-serif' },
      x: 0.5,
      xanchor: 'center',
      pad: { b: 8 },
    },
    xaxis: {
      title: { text: chart.x_label ?? '', font: { size: THEME.font.size.axis, color: THEME.font.muted } },
      tickfont: { color: THEME.font.muted, size: 10 },
      gridcolor: 'rgba(255,255,255,0.04)',
      linecolor: 'rgba(255,255,255,0.08)',
      zerolinecolor: 'rgba(255,255,255,0.08)',
      fixedrange: false,
    },
    yaxis: {
      title: { text: chart.y_label ?? '', font: { size: THEME.font.size.axis, color: THEME.font.muted } },
      tickfont: { color: THEME.font.muted, size: 10 },
      gridcolor: 'rgba(255,255,255,0.04)',
      linecolor: 'rgba(255,255,255,0.08)',
      zerolinecolor: 'rgba(255,255,255,0.08)',
      fixedrange: false,
    },
    dragmode: 'pan',
    paper_bgcolor: THEME.bg.paper,
    plot_bgcolor:  THEME.bg.plot,
    font: { color: THEME.font.color, family: 'Inter, system-ui, sans-serif' },
    margin: { t: 52, b: 52, l: 60, r: 20 },
    legend: {
      font: { color: THEME.font.muted, size: 11 },
      bgcolor: 'rgba(0,0,0,0)',
      bordercolor: 'rgba(255,255,255,0.08)',
    },
    hoverlabel: {
      bgcolor: '#1e293b',
      bordercolor: 'rgba(255,255,255,0.15)',
      font: { color: '#e2e8f0', size: 12 },
    },
  };
}

const PLOTLY_CONFIG = {
  responsive: true,
  displayModeBar: true,
  displaylogo: false,
  scrollZoom: false,
  doubleClick: 'reset',
  showTips: false,
  modeBarButtonsToRemove: [
    'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d',
    'autoScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian',
    'toggleSpikelines',
  ],
  toImageButtonOptions: {
    format: 'png',
    filename: 'chart',
    height: 600,
    width: 1000,
    scale: 2,
  },
};

function ScrollPlot({ data, layout, style }) {
  return (
    <Plot
      data={data}
      layout={layout}
      config={PLOTLY_CONFIG}
      style={style}
      useResizeHandler
    />
  );
}

function renderChart(chart, height) {
  const type   = chart.type;
  const layout = buildCommonLayout(chart, height);
  const hasLongLabels = Array.isArray(chart.x) && chart.x.some(l => l && String(l).length > 10);

  switch (type) {
    case 'line': {
      const traces = chart.series
        ? chart.series.map((s, i) => ({
            x: s.x, y: s.y, type: 'scatter', mode: 'lines+markers',
            name: s.name,
            line: { width: 2.5, color: THEME.colors.series[i % THEME.colors.series.length], shape: 'spline', smoothing: 0.8 },
            marker: { size: 5, color: THEME.colors.series[i % THEME.colors.series.length] },
          }))
        : [{
            x: chart.x, y: chart.y, type: 'scatter', mode: 'lines+markers',
            line: { width: 3, color: THEME.colors.line, shape: 'spline', smoothing: 0.8 },
            marker: { size: 5, color: THEME.colors.line },
          }];
      // Show fallback banner when redirected from funnel (or another type)
      const fallbackBanner = chart.fallback_from ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 11, color: '#fbbf24', fontWeight: 500 }}>
          <span style={{ flexShrink: 0 }}>ℹ</span>
          <span>Funnel not applicable — showing line chart instead{chart.fallback_reason ? ` (${chart.fallback_reason})` : ''}</span>
        </div>
      ) : null;
      return (
        <div>
          {fallbackBanner}
          <ScrollPlot data={traces} layout={layout} style={{ width: '100%' }} />
        </div>
      );
    }

    case 'area': {
      const traces = chart.series
        ? chart.series.map((s, i) => ({
            x: s.x, y: s.y, type: 'scatter', mode: 'lines',
            fill: i === 0 ? 'tozeroy' : 'tonexty',
            name: s.name,
            line: { width: 2.5, color: THEME.colors.series[i % THEME.colors.series.length], shape: 'spline', smoothing: 0.8 },
            fillcolor: THEME.colors.series[i % THEME.colors.series.length] + '28',
          }))
        : [{
            x: chart.x, y: chart.y, type: 'scatter', mode: 'lines',
            fill: 'tozeroy',
            line: { width: 3, color: THEME.colors.area, shape: 'spline', smoothing: 0.8 },
            fillcolor: THEME.colors.area + '28',
          }];
      return <ScrollPlot data={traces} layout={layout} style={{ width: '100%' }} />;
    }

    case 'bar': {
      const isH = chart.orientation === 'h';
      const traces = chart.series
        ? chart.series.map((s, i) => ({
            x: isH ? s.y : s.x, y: isH ? s.x : s.y,
            orientation: isH ? 'h' : 'v',
            type: 'bar', name: s.name,
            marker: { color: THEME.colors.series[i % THEME.colors.series.length], opacity: 0.9, line: { width: 0 } },
          }))
        : [{
            x: isH ? chart.y : chart.x,
            y: isH ? chart.x : chart.y,
            type: 'bar', orientation: isH ? 'h' : 'v',
            marker: { color: THEME.colors.series, opacity: 0.92, line: { width: 0 } },
          }];
      // FIX 4: When bar is a fallback from funnel show an inline info banner.
      const fallbackBanner = chart.fallback_from ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', fontSize: 11, color: '#fbbf24', fontWeight: 500 }}>
          <span style={{ flexShrink: 0 }}>ℹ</span>
          <span>Funnel not applicable — showing bar chart instead{chart.fallback_reason ? ` (${chart.fallback_reason})` : ''}</span>
        </div>
      ) : null;
      return (
        <div>
          {fallbackBanner}
          <ScrollPlot
            data={traces}
            layout={{ ...layout, barmode: 'group', bargap: 0.25, bargroupgap: 0.08, margin: { ...layout.margin, l: isH ? 150 : 60 }, xaxis: { ...layout.xaxis, tickangle: hasLongLabels ? -35 : 0 } }}
            style={{ width: '100%' }}
          />
        </div>
      );
    }

    case 'stacked_bar': {
      const traces = chart.series
        ? chart.series.map((s, i) => ({ x: s.x, y: s.y, type: 'bar', name: s.name, marker: { color: THEME.colors.series[i % THEME.colors.series.length], opacity: 0.9 } }))
        : [{ x: chart.x, y: chart.y, type: 'bar', marker: { color: THEME.colors.series, opacity: 0.9 } }];
      return <ScrollPlot data={traces} layout={{ ...layout, barmode: 'stack', bargap: 0.25 }} style={{ width: '100%' }} />;
    }

    case 'grouped_bar': {
      const traces = chart.series
        ? chart.series.map((s, i) => ({ x: s.x, y: s.y, type: 'bar', name: s.name, marker: { color: THEME.colors.series[i % THEME.colors.series.length], opacity: 0.9 } }))
        : [{ x: chart.x, y: chart.y, type: 'bar', marker: { color: THEME.colors.series, opacity: 0.9 } }];
      return <ScrollPlot data={traces} layout={{ ...layout, barmode: 'group', bargap: 0.2, bargroupgap: 0.06 }} style={{ width: '100%' }} />;
    }

    case 'scatter':
      return (
        <ScrollPlot
          data={[{ x: chart.x, y: chart.y, type: 'scatter', mode: 'markers', marker: { size: 8, color: THEME.colors.scatter, opacity: 0.75, line: { width: 1, color: 'rgba(255,255,255,0.2)' } } }]}
          layout={layout}
          style={{ width: '100%' }}
        />
      );

    case 'bubble': {
      const rawSizes = chart.sizes;
      let markerSizes = 16;
      if (Array.isArray(rawSizes) && rawSizes.length > 0) {
        const min = Math.min(...rawSizes);
        const max = Math.max(...rawSizes);
        const range = max - min || 1;
        markerSizes = rawSizes.map(s => 10 + ((s - min) / range) * 32);
      }
      return (
        <ScrollPlot
          data={[{ x: chart.x, y: chart.y, type: 'scatter', mode: 'markers', marker: { size: markerSizes, color: THEME.colors.bubble, opacity: 0.7, line: { width: 1, color: 'rgba(255,255,255,0.25)' } } }]}
          layout={layout}
          style={{ width: '100%' }}
        />
      );
    }

    case 'pie':
      return (
        <ScrollPlot
          data={[{ labels: chart.x, values: chart.y, type: 'pie', hole: 0.48, marker: { colors: THEME.colors.pie, line: { color: 'rgba(0,0,0,0.4)', width: 1.5 } }, textfont: { color: '#e2e8f0', size: 11 }, hoverinfo: 'label+percent+value' }]}
          layout={{ ...layout, showlegend: true }}
          style={{ width: '100%' }}
        />
      );

    case 'histogram': {
      const vals = chart.values ?? chart.x;
      const s    = chart.stats ?? {};
    
      // ── Bin size: use Freedman-Diaconis from backend, never hardcode nbinsx ──
      // xbins.size tells Plotly exactly how wide each bin should be.
      // This is strictly better than nbinsx (which is just a hint Plotly ignores).
      const xbins = chart.bin_size
        ? { size: chart.bin_size }
        : {};                          // fallback: let Plotly auto-bin (still better than nbinsx: 25)
    
      // ── Axis range: zoom to IQR fence so outliers don't squash the chart ──────
      // chart.x_range is [lo, hi] when outliers exist, null otherwise.
      // When null, let Plotly auto-range (data has no extreme outliers to worry about).
      const xaxisRange = chart.x_range
        ? { range: chart.x_range }
        : {};
    
      // ── Mean / Median annotation lines ────────────────────────────────────────
      // Show mean always. Show median only when it visibly differs from mean
      // (i.e. the distribution is skewed enough that both lines add information).
      const annotations = [];
      const shapes      = [];
    
      const meanColor   = '#F59E0B';   // amber — warm, visible on dark bg
      const medianColor = '#34D399';   // emerald — cool contrast to mean
    
      if (typeof s.mean === 'number') {
        shapes.push({
          type: 'line', xref: 'x', yref: 'paper',
          x0: s.mean, x1: s.mean, y0: 0, y1: 1,
          line: { color: meanColor, width: 1.5, dash: 'dash' },
        });
        annotations.push({
          x: s.mean, yref: 'paper', y: 1.02,
          xanchor: 'center', yanchor: 'bottom',
          text: `μ ${fmtNum(s.mean)}`,
          showarrow: false,
          font: { color: meanColor, size: 10 },
        });
      }
    
      // Only render median line when it's meaningfully different from mean.
      // Threshold: difference > 5% of std dev (avoids clutter on symmetric data).
      const showMedian = typeof s.median === 'number' &&
                        typeof s.mean   === 'number' &&
                        typeof s.std    === 'number' &&
                        s.std > 0 &&
                        Math.abs(s.median - s.mean) > 0.05 * s.std;
    
      if (showMedian) {
        shapes.push({
          type: 'line', xref: 'x', yref: 'paper',
          x0: s.median, x1: s.median, y0: 0, y1: 1,
          line: { color: medianColor, width: 1.5, dash: 'dot' },
        });
        annotations.push({
          x: s.median, yref: 'paper', y: 0.92,
          xanchor: 'center', yanchor: 'bottom',
          text: `M ${fmtNum(s.median)}`,
          showarrow: false,
          font: { color: medianColor, size: 10 },
        });
      }
    
      return (
        <ScrollPlot
          data={[{
            x:      vals,
            type:   'histogram',
            xbins,                        // FD bin width from backend
            marker: {
              color:   THEME.colors.histogram,
              opacity: 0.85,
              line:    { width: 0 },
            },
            // nbinsx intentionally REMOVED — xbins.size overrides it properly
          }]}
          layout={{
            ...layout,
            xaxis: {
              ...layout.xaxis,
              ...xaxisRange,              // IQR-fence zoom (or auto if no outliers)
              title: {
                text: chart.x_label ?? 'Value',
                font: { size: THEME.font.size.axis, color: THEME.font.muted },
              },
            },
            yaxis: {
              ...layout.yaxis,
              title: {
                text: 'Frequency',
                font: { size: THEME.font.size.axis, color: THEME.font.muted },
              },
            },
            bargap:      0.05,
            shapes,        // mean + median vertical lines
            annotations,   // μ and M labels above the lines
          }}
          style={{ width: '100%' }}
        />
      );
    }

    case 'box': {
      // ── Determine groups ────────────────────────────────────────────────────
      // Backend may send either:
      //   chart.groups = [{ name, values }, ...]   (grouped / per-category)
      //   chart.values = [...]                      (single unlabelled series)
      const rawGroups = Array.isArray(chart.groups) && chart.groups.length > 0
        ? chart.groups
        : [{ name: chart.name ?? chart.y_label ?? '', values: chart.values }];

      // ── Compute stats per group (Q1, median, Q3, whiskers) ─────────────────
      function boxStats(arr) {
        const s = [...arr].map(Number).filter(v => !isNaN(v)).sort((a, b) => a - b);
        if (s.length === 0) return null;
        const q1  = s[Math.floor(s.length * 0.25)];
        const med = s[Math.floor(s.length * 0.50)];
        const q3  = s[Math.floor(s.length * 0.75)];
        const iqr = q3 - q1;
        const lo  = Math.max(s[0],  q1 - 1.5 * iqr);
        const hi  = Math.min(s[s.length - 1], q3 + 1.5 * iqr);
        return { q1, med, q3, lo, hi };
      }

      // Sort groups by median descending (highest-value category at top)
      const groups = rawGroups
        .map(g => ({ ...g, stats: boxStats(g.values) }))
        .filter(g => g.stats !== null)
        .sort((a, b) => b.stats.med - a.stats.med);

      if (groups.length === 0) return null;

      // ── Colour palette ──────────────────────────────────────────────────────
      // Use the app's series colours cycling across groups.
      // On a dark background: slightly transparent fill + solid border.
      const BOX_FILL   = 'rgba(186,209,240,0.45)';   // light-blue IQR fill
      const BOX_BORDER = '#6176B5';                   // indigo border
      const MED_COLOR  = '#3730A3';                   // dark indigo median line

      // ── Build one Plotly box trace per group ────────────────────────────────
      // Using Plotly's box trace with pre-computed stats avoids re-sorting the
      // full raw array inside Plotly — and lets us control whisker style.
      const traces = groups.map((g, i) => ({
        type:         'box',
        orientation:  'h',
        name:         g.name,
        q1:           [g.stats.q1],
        median:       [g.stats.med],
        q3:           [g.stats.q3],
        lowerfence:   [g.stats.lo],
        upperfence:   [g.stats.hi],
        y:            [g.name],            // category label on y-axis
        marker: {
          color:   BOX_BORDER,
          size:    4,
          opacity: 0.6,
        },
        line:         { color: BOX_BORDER, width: 1.5 },
        fillcolor:    BOX_FILL,
        whiskerwidth: 0.4,
        // Show the median line as a distinct thick dark line
        medianline:   { color: MED_COLOR, width: 2.5 },
        showlegend:   false,
        hovertemplate: (
          `<b>${g.name}</b><br>` +
          `Median: %{median}<br>` +
          `Q1: %{q1}  Q3: %{q3}<br>` +
          `Whiskers: %{lowerfence} – %{upperfence}` +
          `<extra></extra>`
        ),
      }));

      // ── Median annotations (value label above each box) ─────────────────────
      const prefix = chart.tick_prefix ?? '';
      const suffix = chart.tick_suffix ?? '';
      const annotations = groups.map(g => ({
        x:         g.stats.med,
        y:         g.name,
        text:      prefix + fmtNum(g.stats.med) + suffix,
        showarrow: false,
        xanchor:   'center',
        yanchor:   'bottom',
        yshift:    6,
        font:      { color: MED_COLOR, size: 10, family: 'Inter, system-ui, sans-serif' },
      }));

      // ── Legend dummy traces (IQR box + Median line) ─────────────────────────
      const legendTraces = [
        {
          type: 'box', orientation: 'h',
          name: 'IQR (Q1-Q3)',
          q1: [0], median: [0], q3: [0], lowerfence: [0], upperfence: [0],
          y: [null],
          fillcolor: BOX_FILL,
          line: { color: BOX_BORDER, width: 1.5 },
          marker: { color: BOX_BORDER },
          showlegend: true,
          visible: 'legendonly',   // won't appear on plot, only in legend
        },
        {
          type: 'scatter', mode: 'lines',
          name: 'Median',
          x: [null], y: [null],
          line: { color: MED_COLOR, width: 2.5 },
          showlegend: true,
        },
      ];

      // ── Layout ───────────────────────────────────────────────────────────────
      const chartHeight = Math.max(height, groups.length * 62 + 100);

      const xMax = Math.max(...groups.map(g => g.stats.hi));
      const tickStep = niceStep(xMax / 6);

      const boxLayout = {
        ...layout,
        height:      chartHeight,
        orientation: 'h',
        xaxis: {
          ...layout.xaxis,
          title:      { text: chart.x_label ?? '', font: { size: THEME.font.size.axis, color: THEME.font.muted } },
          tickprefix: chart.tick_prefix ?? '',   // backend sets e.g. '$', '€', '£' or omits
          ticksuffix: chart.tick_suffix ?? '',   // backend sets e.g. '%', 'kg' or omits
          tickformat: chart.tick_format ?? '',   // backend sets e.g. ',.0f' or omits
          dtick:      tickStep || undefined,
          gridcolor: 'rgba(255,255,255,0.06)',
          zeroline:  true,
          zerolinecolor: 'rgba(255,255,255,0.1)',
        },
        yaxis: {
          ...layout.yaxis,
          title:     { text: '' },
          automargin: true,
          tickfont:  { color: THEME.font.color, size: 11 },
          gridcolor: 'rgba(255,255,255,0.04)',
        },
        boxmode:   'overlay',
        showlegend: true,
        legend: {
          x: 1, y: 1, xanchor: 'right', yanchor: 'top',
          bgcolor:     'rgba(255,255,255,0.05)',
          bordercolor: 'rgba(255,255,255,0.12)',
          borderwidth: 1,
          font: { color: THEME.font.color, size: 11 },
        },
        margin: { ...layout.margin, l: Math.min(160, Math.max(...groups.map(g => g.name.length)) * 7 + 12), r: 40, t: 50, b: 50 },
        annotations,
      };

      return (
        <ScrollPlot
          data={[...traces, ...legendTraces]}
          layout={boxLayout}
          style={{ width: '100%' }}
        />
      );
    }

    case 'heatmap': {
      // Build the cell annotation text layer (only present when grid ≤ 10×10).
      // Each cell shows its formatted raw value so readers don't have to guess
      // from color alone — critical for business dashboards.
      const annotations = [];
      if (Array.isArray(chart.cell_annotations)) {
        chart.cell_annotations.forEach((row, ri) => {
          row.forEach((val, ci) => {
            annotations.push({
              x:          chart.x[ci],
              y:          chart.y[ri],
              text:       val != null ? fmtNum(val) : '',
              showarrow:  false,
              font:       { color: '#e2e8f0', size: 10 },
              xref:       'x',
              yref:       'y',
            });
          });
        });
      }

      // Color scale: deep purple → indigo → lavender.
      // High contrast between min and max so differences are immediately visible.
      // Avoid washed-out single-hue gradients that make everything look similar.
      const colorscale = [
        [0,    '#0f0a2e'],
        [0.15, '#1e1b4b'],
        [0.35, '#3730a3'],
        [0.55, '#6366f1'],
        [0.75, '#a5b4fc'],
        [1,    '#e0e7ff'],
      ];

      // Label the color bar correctly: if log scale was applied on the backend,
      // tell the reader the axis is log1p-transformed so they aren't misled.
      const colorbarTitle = chart.use_log_scale
        ? `${chart.z_label ?? 'Value'} (log scale)`
        : (chart.z_label ?? 'Value');

      return (
        <ScrollPlot
          data={[{
            x:          chart.x,
            y:          chart.y,
            z:          chart.z,
            type:       'heatmap',
            colorscale,
            showscale:  true,
            colorbar: {
              title:    { text: colorbarTitle, font: { color: THEME.font.muted, size: 10 }, side: 'right' },
              tickfont: { color: THEME.font.muted, size: 10 },
              thickness: 14,
              len:       0.85,
            },
            hovertemplate: `<b>%{y}</b> × <b>%{x}</b><br>${chart.z_label ?? 'Value'}: %{z:.2f}<extra></extra>`,
            xgap:  1.5,   // small gaps between cells improve readability
            ygap:  1.5,
          }]}
          layout={{
            ...layout,
            annotations,                       // cell value text labels
            xaxis: {
              ...layout.xaxis,
              tickangle: hasLongLabels ? -40 : 0,
              title: { text: chart.x_label ?? '', font: { size: THEME.font.size.axis, color: THEME.font.muted } },
            },
            yaxis: {
              ...layout.yaxis,
              title: { text: chart.y_label ?? '', font: { size: THEME.font.size.axis, color: THEME.font.muted } },
              autorange: 'reversed',           // keep sorted order top-to-bottom
            },
            margin: { ...layout.margin, b: hasLongLabels ? 100 : 60, r: 80 },
          }}
          style={{ width: '100%' }}
        />
      );
    }

    case 'funnel': {
      // Build per-step custom text showing step-over-step conversion rate.
      // For the first step show the absolute value; for subsequent steps show
      // the conversion % from the prior step and flag the biggest drop-off.
      const convPcts    = chart.conversion_pcts ?? [];
      const dropIdx     = chart.biggest_drop_idx ?? null;
      const customText  = (chart.x ?? []).map((_, i) => {
        if (i === 0) return fmtNum(chart.y[i]);
        const pct  = convPcts[i];
        const base = pct != null ? `${pct}% from prev` : fmtNum(chart.y[i]);
        return i === dropIdx ? `⚠ ${base}` : base;
      });

      // Highlight the biggest drop-off step with a distinct red marker color;
      // keep all other steps in the same indigo tone (1–2 colors max).
      const markerColors = (chart.x ?? []).map((_, i) =>
        i === dropIdx ? '#EF4444' : '#6366F1'
      );

      return (
        <ScrollPlot
          data={[{
            type:       'funnel',
            y:          chart.x,          // stages on y-axis (horizontal funnel)
            x:          chart.y,          // values on x-axis
            text:       customText,
            textinfo:   'text',           // show our custom text only (no redundant percent initial)
            textfont:   { color: '#e2e8f0', size: 12 },
            marker: {
              color: markerColors,
              line:  { color: 'rgba(0,0,0,0.3)', width: 1 },
            },
            connector:  { fillcolor: 'rgba(99,102,241,0.10)' },
            hovertemplate: '<b>%{y}</b><br>Value: %{x}<extra></extra>',
          }]}
          layout={{
            ...layout,
            // Remove funnelmode: 'stack' — single-series funnels should be
            // rendered as a plain funnel (not stacked), which shows the
            // narrowing shape that communicates drop-off.
            margin: { ...layout.margin, l: 160, r: 40 },
          }}
          style={{ width: '100%' }}
        />
      );
    }

    case 'treemap':
      return (
        <ScrollPlot
          data={[{ type: 'treemap', labels: chart.labels, values: chart.values, parents: chart.labels.map(() => ''), textfont: { color: '#fff', size: 12 }, marker: { colorscale: [[0,'#312e81'],[0.33,'#4f46e5'],[0.66,'#818cf8'],[1,'#c7d2fe']], showscale: false }, hovertemplate: '<b>%{label}</b><br>%{value}<extra></extra>' }]}
          layout={{ ...layout, margin: { t: 48, b: 8, l: 8, r: 8 } }}
          style={{ width: '100%' }}
        />
      );

    case 'waterfall': {
      const measures = chart.y.map((v, i) => i === chart.y.length - 1 ? 'total' : 'relative');
      return (
        <ScrollPlot
          data={[{ type: 'waterfall', x: chart.x, y: chart.y, measure: measures, increasing: { marker: { color: '#34d399' } }, decreasing: { marker: { color: '#f87171' } }, totals: { marker: { color: THEME.colors.waterfall } }, connector: { line: { color: 'rgba(255,255,255,0.15)', width: 1, dash: 'dot' } }, textfont: { color: THEME.font.color } }]}
          layout={layout}
          style={{ width: '100%' }}
        />
      );
    }

    case 'not_possible': {
      const requestedType = chart.requested_type ?? 'This chart';
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-4 px-6 text-center">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <p className="text-amber-300 font-semibold text-sm mb-1">Cannot render {requestedType} chart</p>
            <p className="text-slate-500 text-xs leading-relaxed max-w-[280px]">
              Your dataset doesn't have the columns needed. Try a different chart type or upload a different dataset.
            </p>
          </div>
        </div>
      );
    }

    default:
      return <div className="text-yellow-400 text-sm p-4">Unsupported chart type: {type}</div>;
  }
}

// ─── ChartFullscreenModal

function ChartFullscreenModal({ chart, onClose }) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
 
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
 
  // Fullscreen chart height: viewport minus header bar + insight badge space
  const fsHeight = Math.max(400, window.innerHeight - 140);
 
  // Portal renders outside the normal DOM tree so z-index always wins
  return ReactDOM.createPortal(
    // ── Backdrop ────────────────────────────────────────────────────────────
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}                     // click outside → close
    >
      {/* ── Modal panel ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full max-w-[1280px] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#0f172a', maxHeight: 'calc(100vh - 32px)' }}
        onClick={(e) => e.stopPropagation()}  // prevent backdrop close when clicking inside
      >
 
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 flex-shrink-0">
          <span className="text-sm font-semibold text-slate-200 truncate pr-4">
            {chart.title ?? 'Chart'}
          </span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Close fullscreen"
          >
            <X size={16} />
          </button>
        </div>
 
        {/* ── Chart area ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-2 pt-3">
          {renderChart(chart, fsHeight)}
        </div>
 
        {/* ── Insight badge ────────────────────────────────────────────── */}
        <div className="px-5 pb-4 pt-1 flex-shrink-0">
          <InsightBadge chart={chart} />
        </div>
      </div>
    </div>,
    document.body   // portal target
  );
}

// ─────────────────────────────────────────────
// CHART CARD
// ─────────────────────────────────────────────

function ChartCard({ chart }) {
  const { gridSpan, height } = getSize(chart?.layout_size);
  const [isFullscreen, setIsFullscreen] = useState(false);
 
  const validationError = validateChart(chart);
  if (validationError) {
    return (
      <div className={`${gridSpan} flex items-center justify-center rounded-2xl border border-yellow-500/20 bg-yellow-950/10 text-yellow-400 text-xs p-4 min-h-[160px]`}>
        <span>⚠ {validationError}</span>
      </div>
    );
  }
 
  return (
    <>
      {/* ── Normal card (unchanged layout) ──────────────────────────────── */}
      <div
        className={`${gridSpan} group relative rounded-2xl border border-white/8 bg-[#0f172a]/80 shadow-xl overflow-hidden`}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {/* ── Fullscreen trigger button ──────────────────────────────────
            Hidden by default, visible on hover via Tailwind group-hover.
            Positioned absolute top-right inside the card.               */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center
                     w-7 h-7 rounded-lg
                     bg-white/0 hover:bg-white/10
                     text-slate-600 hover:text-slate-200
                     opacity-0 group-hover:opacity-100
                     transition-all duration-150"
          aria-label="View fullscreen"
          title="Fullscreen"
        >
          <Maximize2 size={13} />
        </button>
 
        <ChartErrorBoundary>
          <div className="pt-2 px-1">
            {renderChart(chart, height)}
          </div>
          <div className="px-4 pb-4">
            <InsightBadge chart={chart} />
          </div>
        </ChartErrorBoundary>
      </div>
 
      {/* ── Fullscreen modal (portal, renders outside this DOM tree) ───── */}
      {isFullscreen && (
        <ChartFullscreenModal
          chart={chart}
          onClose={() => setIsFullscreen(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// TABLE COMPONENT
// ─────────────────────────────────────────────

const TABLE_PAGE_SIZE = 50;

function DataTable({ table }) {
  const [page, setPage] = useState(0);
  const rows    = table.data ?? [];
  const total   = rows.length;
  const pages   = Math.ceil(total / TABLE_PAGE_SIZE);
  const visible = rows.slice(page * TABLE_PAGE_SIZE, (page + 1) * TABLE_PAGE_SIZE);
  const cols    = Object.keys(rows[0] ?? {});

  const downloadCSV = () => {
    if (!rows.length) return;
    const csv = [
      cols.join(','),
      ...rows.map(r => cols.map(h => `"${r[h] ?? ''}"`).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${table.title || 'table'}.csv` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="bg-[#0f172a] rounded-2xl border border-white/8 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
        <h3 className="text-white font-semibold text-sm">{table.title || 'Table'}</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500">{total.toLocaleString()} rows</span>
          <button onClick={downloadCSV} className="text-xs px-3 py-1 bg-white/8 hover:bg-white/14 text-slate-300 rounded-lg transition font-medium">
            ⬇ CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-white">
          <thead>
            <tr className="bg-white/4">
              {cols.map((col, j) => (
                <th key={j} className="px-4 py-2.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap border-b border-white/6">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, ri) => (
              <tr key={ri} className={`border-b border-white/4 transition-colors ${ri % 2 === 0 ? '' : 'bg-white/[0.02]'} hover:bg-white/6`}>
                {cols.map((col, vi) => (
                  <td key={vi} className="px-4 py-2 text-slate-300 whitespace-nowrap">{row[col] ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/6 text-xs text-slate-500">
          <span>Showing {page * TABLE_PAGE_SIZE + 1}–{Math.min((page + 1) * TABLE_PAGE_SIZE, total)} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 rounded-lg bg-white/6 hover:bg-white/12 disabled:opacity-30 transition">‹ Prev</button>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1} className="px-3 py-1 rounded-lg bg-white/6 hover:bg-white/12 disabled:opacity-30 transition">Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// QUERY RESULT PANEL  ← NEW
// Each query gets one of these blocks, stacked vertically on screen.
// The query label badge sits in the top-right corner (matching the mockup).
// ─────────────────────────────────────────────

// Accent colors cycling across panels so each query block looks distinct
const PANEL_ACCENTS = ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#14B8A6'];

function QueryResultPanel({ entry, index }) {
  const { query, data } = entry;
  const accent = PANEL_ACCENTS[index % PANEL_ACCENTS.length];

  const hasError      = typeof data?.error === 'string' && data.error.length > 0;
  const hasScorecards = Array.isArray(data?.scorecards) && data.scorecards.length > 0;
  const hasCharts     = Array.isArray(data?.charts)     && data.charts.length > 0;
  const hasTables     = Array.isArray(data?.tables)     && data.tables.length > 0;

  return (
    <div className="relative mb-10">
      {/* ── Query label badge (top-right, like the mockup) ── */}
      <div className="flex justify-end mb-3">
        <div
          className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}22)`, border: `1.5px solid ${accent}55` }}
        >
          <span style={{ color: accent }}>Q{index + 1}</span>
          <span className="ml-2 text-slate-300 font-normal truncate max-w-[400px] inline-block align-bottom">
            {query.length > 60 ? query.slice(0, 57) + '…' : query}
          </span>
        </div>
      </div>

      {/* ── Result block ── */}
      <div
        className="rounded-2xl border p-5"
        style={{
          borderColor: hasError ? 'rgba(239,68,68,0.25)' : `${accent}22`,
          background: hasError ? 'rgba(30,10,10,0.6)' : 'rgba(15,23,42,0.6)',
          boxShadow: hasError
            ? '0 0 0 1px rgba(239,68,68,0.1), 0 8px 32px rgba(0,0,0,0.3)'
            : `0 0 0 1px ${accent}11, 0 8px 32px rgba(0,0,0,0.3)`,
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* ── Off-topic / error message ── */}
        {hasError && (
          <div className="flex items-start gap-3 py-4 px-2">
            <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <span className="text-red-400 text-base">✕</span>
            </div>
            <div>
              <p className="text-red-300 font-semibold text-sm mb-1">Query not supported</p>
              <p className="text-slate-400 text-sm leading-relaxed">{data.error}</p>
            </div>
          </div>
        )}

        {!hasError && hasScorecards && <ScorecardRow scorecards={data.scorecards} />}

        {!hasError && hasCharts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {data.charts.map((chart, i) => (
              <ChartCard key={i} chart={chart} />
            ))}
          </div>
        )}

        {!hasError && hasTables && (
          <div className={`space-y-6 ${hasCharts ? 'mt-8' : ''}`}>
            {data.tables.map((table, i) => (
              <DataTable key={i} table={table} />
            ))}
          </div>
        )}

        {/* Fallback: valid response but nothing to show */}
        {!hasError && !hasScorecards && !hasCharts && !hasTables && (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            No results returned for this query.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LOADING PANEL  ← NEW
// Shown at the bottom while a new query is running.
// ─────────────────────────────────────────────

function LoadingPanel({ query }) {
  return (
    <div className="relative mb-10">
      <div className="flex justify-end mb-3">
        <div className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-white border border-white/10 bg-white/5 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-indigo-400" />
          <span className="text-indigo-300 font-normal truncate max-w-[400px]">
            {query.length > 60 ? query.slice(0, 57) + '…' : query}
          </span>
        </div>
      </div>
      <div className="rounded-2xl border border-white/8 bg-[#0f172a]/60 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <ChartSkeleton key={i} height={340} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN EXPORT  (CHANGED signature)
// Props:
//   queryHistory  – array of { query, data }
//   loading       – bool, true while a task is running
//   currentQuery  – the prompt currently typed (used to label the loading panel)
// ─────────────────────────────────────────────

const AnalysisOutput = ({ queryHistory = [], loading = false, currentQuery = '' }) => {
  const hasHistory = queryHistory.length > 0;

  if (!hasHistory && !loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-10">
        <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-5">
          <BarChart2 size={40} className="text-indigo-400" />
        </div>
        <h3 className="text-lg text-slate-300 mb-2 font-semibold">No Analysis Yet</h3>
        <p className="text-slate-500 text-sm">Upload a file and enter a prompt to generate charts</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Render all completed query result panels (oldest → newest) */}
      {queryHistory.map((entry, i) => (
        <QueryResultPanel key={i} entry={entry} index={i} />
      ))}

      {/* Append loading skeleton at the bottom while new query runs */}
      {loading && <LoadingPanel query={currentQuery} />}
    </div>
  );
};

export default AnalysisOutput;