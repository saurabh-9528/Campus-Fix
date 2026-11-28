import React, { useId, useMemo, useState } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import { countOf, formatNumber, formatPeriodLabel } from '../../utils/analytics';

const CHART_WIDTH = 640;
const DEFAULT_CHART_HEIGHT = 240;
const PADDING = { top: 18, right: 18, bottom: 34, left: 38 };

const niceMax = (value) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  let step = 10;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 2.5) step = 2.5;
  else if (normalized <= 5) step = 5;
  return step * magnitude;
};

const getLabelIndices = (length) => {
  if (length <= 7) return Array.from({ length }, (_, index) => index);
  const step = Math.ceil((length - 1) / 4);
  const indices = [];
  for (let index = 0; index < length; index += step) indices.push(index);
  if (indices[indices.length - 1] !== length - 1) indices.push(length - 1);
  return indices;
};

export const ChartEmptyState = ({
  title = 'No data yet',
  description = 'Data will appear here once activity is recorded.',
  compact = false,
}) => (
  <div
    className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-5 text-center ${
      compact ? 'py-8' : 'py-12'
    }`}
  >
    <ChartNoAxesColumn className={`${compact ? 'h-7 w-7' : 'h-9 w-9'} text-gray-300`} />
    <p className="mt-3 text-sm font-semibold text-gray-700">{title}</p>
    <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">{description}</p>
  </div>
);

export const TrendChart = ({
  points = [],
  granularity = 'daily',
  height = DEFAULT_CHART_HEIGHT,
  compact = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const rawId = useId();
  const gradientId = `trend-fill-${rawId.replace(/:/g, '')}`;
  const data = useMemo(() => (Array.isArray(points) ? points : []), [points]);
  const totals = useMemo(
    () =>
      data.reduce(
        (sum, point) => ({
          submitted: sum.submitted + countOf(point?.submitted),
          resolved: sum.resolved + countOf(point?.resolved),
        }),
        { submitted: 0, resolved: 0 }
      ),
    [data]
  );

  if (!data.length || (totals.submitted === 0 && totals.resolved === 0)) {
    return (
      <ChartEmptyState
        compact={compact}
        title="No complaint activity yet"
        description="Volume and resolution trends will appear after the first complaints are submitted."
      />
    );
  }

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const bottomY = PADDING.top + innerHeight;
  const maxValue = niceMax(
    Math.max(...data.flatMap((point) => [countOf(point.submitted), countOf(point.resolved)]), 1)
  );
  const x = (index) =>
    PADDING.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value) => PADDING.top + innerHeight - (countOf(value) / maxValue) * innerHeight;
  const linePath = (key) =>
    data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(point[key])}`).join(' ');
  const submittedPath = linePath('submitted');
  const resolvedPath = linePath('resolved');
  const areaPath = `${submittedPath} L ${x(data.length - 1)} ${bottomY} L ${x(0)} ${bottomY} Z`;
  const labelIndices = getLabelIndices(data.length);
  const activePoint = activeIndex === null ? null : data[activeIndex];
  const bandWidth = data.length > 1 ? innerWidth / (data.length - 1) : innerWidth;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-xs font-medium text-gray-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary-500" />
            Submitted
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Resolved
          </span>
        </div>
        <span className="text-[11px] font-medium text-gray-400">
          {compact ? 'Last activity window' : 'Hover the chart for details'}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Complaint ${granularity} volume and resolution trend`}
        onMouseLeave={() => setActiveIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const gridY = PADDING.top + innerHeight - fraction * innerHeight;
          return (
            <g key={fraction}>
              <line
                x1={PADDING.left}
                x2={CHART_WIDTH - PADDING.right}
                y1={gridY}
                y2={gridY}
                stroke="#f1f5f9"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 8}
                y={gridY + 4}
                textAnchor="end"
                className="fill-gray-400 text-[10px]"
              >
                {Math.round(maxValue * fraction)}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={submittedPath}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={resolvedPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((point, index) => (
          <rect
            key={`hit-${point.period || index}`}
            x={x(index) - bandWidth / 2}
            y={PADDING.top}
            width={bandWidth}
            height={innerHeight}
            fill="transparent"
            onMouseEnter={() => setActiveIndex(index)}
            onFocus={() => setActiveIndex(index)}
            tabIndex={0}
            role="presentation"
          />
        ))}

        {data.map((point, index) => {
          const isActive = activeIndex === index;
          if (data.length > 16 && !isActive) return null;
          return (
            <g key={`point-${point.period || index}`} pointerEvents="none">
              <circle
                cx={x(index)}
                cy={y(point.submitted)}
                r={isActive ? 4.5 : 3}
                fill="#ffffff"
                stroke="#10b981"
                strokeWidth="2"
              />
              <circle
                cx={x(index)}
                cy={y(point.resolved)}
                r={isActive ? 4.5 : 3}
                fill="#ffffff"
                stroke="#3b82f6"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {activePoint && (
          <g pointerEvents="none">
            <line
              x1={x(activeIndex)}
              x2={x(activeIndex)}
              y1={PADDING.top}
              y2={bottomY}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={x(activeIndex)}
              cy={y(activePoint.submitted)}
              r="5"
              fill="#10b981"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <circle
              cx={x(activeIndex)}
              cy={y(activePoint.resolved)}
              r="5"
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}

        {labelIndices.map((index) => (
          <text
            key={`label-${data[index]?.period || index}`}
            x={x(index)}
            y={height - 10}
            textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
            className="fill-gray-400 text-[10px]"
          >
            {formatPeriodLabel(data[index]?.period, granularity)}
          </text>
        ))}
      </svg>

      <div className="mt-1 flex min-h-5 flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
        <span>
          {activePoint
            ? `${formatPeriodLabel(activePoint.period, granularity)} · ${countOf(
                activePoint.submitted
              )} submitted · ${countOf(activePoint.resolved)} resolved`
            : `${formatNumber(totals.submitted)} submitted · ${formatNumber(
                totals.resolved
              )} resolved in view`}
        </span>
        {activePoint && (
          <span className="font-semibold text-gray-700">
            {countOf(activePoint.resolved) > 0
              ? `${Math.round(
                  (countOf(activePoint.resolved) / Math.max(countOf(activePoint.submitted), 1)) * 100
                )}% resolved`
              : 'No resolutions'}
          </span>
        )}
      </div>
    </div>
  );
};

export const DonutChart = ({
  segments = [],
  total,
  centerLabel = 'Total',
  centerValue,
  size = 170,
  thickness = 20,
  emptyTitle = 'No data yet',
  emptyDescription = 'Breakdowns will appear once records exist.',
}) => {
  const positiveSegments = useMemo(
    () => (Array.isArray(segments) ? segments : []).filter((segment) => countOf(segment.value) > 0),
    [segments]
  );
  const computedTotal = useMemo(() => {
    const explicitTotal = Number(total);
    if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal;
    return positiveSegments.reduce((sum, segment) => sum + countOf(segment.value), 0);
  }, [positiveSegments, total]);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const chartSegments = useMemo(
    () =>
      positiveSegments.reduce(
        (accumulator, segment) => {
          const value = countOf(segment.value);
          const segmentLength = (value / computedTotal) * circumference;
          const dashLength = Math.max(segmentLength - 1.5, 0.5);
          return {
            offset: accumulator.offset + segmentLength,
            items: [
              ...accumulator.items,
              {
                ...segment,
                value,
                dashLength,
                dashOffset: -accumulator.offset,
              },
            ],
          };
        },
        { offset: 0, items: [] }
      ).items,
    [positiveSegments, computedTotal, circumference]
  );

  if (!positiveSegments.length || computedTotal <= 0) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={thickness}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tracking-tight text-gray-900">0</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {centerLabel}
            </span>
          </div>
        </div>
        <p className="text-center text-xs leading-5 text-gray-500">
          <span className="block text-sm font-semibold text-gray-700">{emptyTitle}</span>
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${centerLabel} distribution`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={thickness}
          />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {chartSegments.map((segment) => (
              <circle
                key={segment.key || segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color || '#10b981'}
                strokeWidth={thickness}
                strokeDasharray={`${segment.dashLength} ${circumference - segment.dashLength}`}
                strokeDashoffset={segment.dashOffset}
              >
                <title>
                  {segment.label}: {formatNumber(segment.value)} (
                  {Math.round((segment.value / computedTotal) * 100)}%)
                </title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-gray-900">
            {centerValue ?? formatNumber(computedTotal)}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-2.5">
        {positiveSegments.map((segment) => {
          const value = countOf(segment.value);
          return (
            <li
              key={segment.key || segment.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color || '#10b981' }}
                />
                <span className="truncate text-gray-600">{segment.label}</span>
              </span>
              <span className="flex-shrink-0 text-xs font-semibold text-gray-900">
                {formatNumber(value)}
                <span className="ml-1.5 font-normal text-gray-400">
                  {Math.round((value / computedTotal) * 100)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const BarList = ({
  items = [],
  emptyTitle = 'No data yet',
  emptyDescription = 'Breakdowns will appear once records exist.',
  showPercentage = true,
}) => {
  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + countOf(item.value), 0);
  const maxValue = Math.max(...safeItems.map((item) => countOf(item.value)), 1);

  if (!safeItems.length || total <= 0) {
    return <ChartEmptyState title={emptyTitle} description={emptyDescription} compact />;
  }

  return (
    <div className="space-y-4">
      {safeItems.map((item) => {
        const value = countOf(item.value);
        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
        const width = value > 0 ? Math.max((value / maxValue) * 100, 4) : 0;
        return (
          <div key={item.key || item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-700">
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: item.color || '#10b981' }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="flex-shrink-0 text-xs font-semibold text-gray-900">
                {formatNumber(value)}
                {showPercentage && (
                  <span className="ml-1.5 font-normal text-gray-400">{percentage}%</span>
                )}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${width}%`, backgroundColor: item.color || '#10b981' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
