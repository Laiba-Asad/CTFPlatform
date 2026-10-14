import type { LeaderboardSeries } from '@cydemic/shared';
import { useId } from 'react';
import { cn } from '../lib/cn';

interface ScoreChartProps {
  series: LeaderboardSeries[];
  className?: string;
}

const W = 720;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

/**
 * Score-over-time line chart in the flat brand style: the viewer's line is teal,
 * everyone else is ink at low opacity. Flat strokes only, no extra hues.
 */
export function ScoreChart({ series, className }: ScoreChartProps) {
  const titleId = useId();
  const withPoints = series.filter((s) => s.points.length > 0);
  if (withPoints.length === 0) {
    return <p className={cn('text-base text-ink/65', className)}>No scores yet. The chart appears after the first solve.</p>;
  }

  const allTimes = withPoints.flatMap((s) => s.points.map((p) => Date.parse(p.t)));
  const minT = Math.min(...allTimes);
  const maxT = Math.max(...allTimes, minT + 1);
  const maxScore = Math.max(1, ...withPoints.flatMap((s) => s.points.map((p) => p.score)));

  const x = (t: number) => PAD.left + ((t - minT) / (maxT - minT)) * (W - PAD.left - PAD.right);
  const y = (score: number) => H - PAD.bottom - (score / maxScore) * (H - PAD.top - PAD.bottom);

  const line = (s: LeaderboardSeries) => {
    // Step line: score holds flat then jumps at each solve.
    const pts: Array<[number, number]> = [[x(minT), y(0)]];
    for (const p of s.points) {
      const px = x(Date.parse(p.t));
      pts.push([px, pts[pts.length - 1]![1]]);
      pts.push([px, y(p.score)]);
    }
    pts.push([x(maxT), pts[pts.length - 1]![1]]);
    return pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  };

  const yTicks = [0, Math.round(maxScore / 2), maxScore];

  return (
    <figure className={className}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={titleId} preserveAspectRatio="xMidYMid meet">
        <title id={titleId}>Score over time for the top players</title>
        {/* y grid + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-ink/50 font-mono text-[10px]">
              {t}
            </text>
          </g>
        ))}
        {/* non-viewer lines first, then the viewer on top */}
        {withPoints
          .filter((s) => !s.isYou)
          .map((s) => (
            <path key={s.name} d={line(s)} fill="none" className="stroke-ink/25" strokeWidth={1.5} strokeLinejoin="round" />
          ))}
        {withPoints
          .filter((s) => s.isYou)
          .map((s) => (
            <path key={s.name} d={line(s)} fill="none" className="stroke-teal" strokeWidth={2.5} strokeLinejoin="round" />
          ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/65">
        {withPoints.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-block h-0.5 w-4', s.isYou ? 'bg-teal' : 'bg-ink/25')} aria-hidden="true" />
            <span className={cn(s.isYou && 'font-semibold text-ink')}>{s.name}{s.isYou ? ' (you)' : ''}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
