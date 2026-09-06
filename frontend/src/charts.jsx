// visx-based charts for the suite (same lib family as Run Track). An area chart
// with a gradient fill for trends/drill-downs, and a compact sparkline for the
// Insights watchlist rows. Both scale to their container via ParentSize.
import { ParentSize } from "@visx/responsive";
import { AreaClosed, LinePath, Bar } from "@visx/shape";
import { scaleLinear } from "@visx/scale";
import { LinearGradient } from "@visx/gradient";
import { curveMonotoneX } from "@visx/curve";
import { Group } from "@visx/group";
import { useId, useState } from "react";
import { money } from "./lib.jsx";

const val = (d) => d.total;

// Big gradient area chart — the "stock chart" look. Optional hover readout.
export function AreaChart({ data, height = 220, color = "var(--accent)", onHover }) {
  return (
    <ParentSize>
      {({ width }) => width > 0 && (
        <AreaInner data={data} width={width} height={height} color={color} onHover={onHover} />
      )}
    </ParentSize>
  );
}

function AreaInner({ data, width, height, color, onHover }) {
  const gid = useId().replace(/:/g, "");
  const padX = 8, padTop = 16, padBottom = 26, padLabel = 34;
  const innerW = width - padX * 2 - padLabel;
  const innerH = height - padTop - padBottom;
  if (!data.length) return null;

  const max = Math.max(...data.map(val)) * 1.15 || 1;
  const x = scaleLinear({ domain: [0, Math.max(data.length - 1, 1)], range: [0, innerW] });
  const y = scaleLinear({ domain: [0, max], range: [innerH, 0] });
  const gx = (i) => padX + padLabel + x(i);
  const gy = (d) => padTop + y(val(d));

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}
      onMouseLeave={() => onHover && onHover(null)}>
      <LinearGradient id={`g${gid}`} from={color} to={color} fromOpacity={0.28} toOpacity={0.02} />
      {/* horizontal gridlines */}
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={padX + padLabel} x2={width - padX} y1={padTop + innerH * t} y2={padTop + innerH * t}
          stroke="var(--grid)" strokeWidth="1" />
      ))}
      <Group>
        <AreaClosed data={data} x={(_, i) => gx(i)} y={(d) => gy(d)} yScale={y}
          curve={curveMonotoneX} fill={`url(#g${gid})`} />
        <LinePath data={data} x={(_, i) => gx(i)} y={(d) => gy(d)} curve={curveMonotoneX}
          stroke={color} strokeWidth={2.2} />
        {data.map((d, i) => (
          <g key={d.key}>
            <circle cx={gx(i)} cy={gy(d)} r={3.5} fill="var(--surface)" stroke={color} strokeWidth={2} />
            <text x={gx(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
            {onHover && (
              <Bar x={gx(i) - innerW / (2 * Math.max(data.length - 1, 1))} y={padTop}
                width={innerW / Math.max(data.length - 1, 1)} height={innerH} fill="transparent"
                onMouseMove={() => onHover(d)} />
            )}
          </g>
        ))}
      </Group>
    </svg>
  );
}

// Dependency-free monthly line graph for the Insights cards. Pure SVG with a
// fixed viewBox scaled to 100% width, so it renders everywhere without any
// container measuring. x = month, y = spend, with a hover tooltip per point.
export function MiniLineChart({ data, color = "var(--accent)", onHover }) {
  const [hi, setHi] = useState(null);
  const W = 320, H = 150, padL = 40, padR = 14, padT = 14, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  if (!data || !data.length) {
    return <div style={{ color: "var(--muted)", fontSize: 12, padding: 24, textAlign: "center" }}>No spend in range.</div>;
  }

  const max = Math.max(...data.map((d) => d.total)) || 1;
  const x = (i) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => padT + innerH - (v / (max * 1.12)) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.total).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)} ${padT + innerH} L${x(0).toFixed(1)} ${padT + innerH} Z`;
  const gid = "ml" + useId().replace(/:/g, "");
  const fmtY = (v) => v >= 1000 ? `R${(v / 1000).toFixed(1)}k` : `R${Math.round(v)}`;
  const tip = hi != null ? data[hi] : null;

  const setHover = (i) => { setHi(i); if (onHover) onHover(i == null ? null : data[i]); };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", fontFamily: "inherit" }}
      onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* y gridlines + labels */}
      {[0, 0.5, 1].map((t) => {
        const gy = padT + innerH * t;
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={gy} y2={gy} stroke="var(--grid)" strokeWidth="1" />
            <text x={padL - 6} y={gy + 3} textAnchor="end" fontSize="9" fill="var(--muted)">{fmtY(max * 1.12 * (1 - t))}</text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.key}>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
          <circle cx={x(i)} cy={y(d.total)} r={hi === i ? 4.5 : 3} fill={hi === i ? color : "var(--surface)"} stroke={color} strokeWidth="2" />
          {/* wide invisible hit target for easy hover */}
          <rect x={x(i) - innerW / (2 * Math.max(data.length - 1, 1))} y={padT} width={Math.max(innerW / Math.max(data.length - 1, 1), 24)} height={innerH}
            fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      {/* hover tooltip */}
      {tip && (() => {
        const tw = 78, tx = Math.min(Math.max(x(hi) - tw / 2, 2), W - tw - 2), ty = Math.max(y(tip.total) - 38, 2);
        return (
          <g pointerEvents="none">
            <line x1={x(hi)} x2={x(hi)} y1={padT} y2={padT + innerH} stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <rect x={tx} y={ty} width={tw} height={30} rx="6" fill="var(--surface-2)" stroke="var(--ring)" />
            <text x={tx + tw / 2} y={ty + 12} textAnchor="middle" fontSize="9" fill="var(--muted)">{tip.label}</text>
            <text x={tx + tw / 2} y={ty + 24} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ink)">{money(tip.total)}</text>
          </g>
        );
      })()}
    </svg>
  );
}

// Compact sparkline for a watchlist row — line only, tinted rise/fall colour.
export function Sparkline({ data, width = 96, height = 34, color }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data.map(val)), min = Math.min(...data.map(val));
  const x = scaleLinear({ domain: [0, data.length - 1], range: [2, width - 2] });
  const y = scaleLinear({ domain: [min, max || 1], range: [height - 3, 3] });
  const gid = useId().replace(/:/g, "");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <LinearGradient id={`s${gid}`} from={color} to={color} fromOpacity={0.22} toOpacity={0} />
      <AreaClosed data={data} x={(_, i) => x(i)} y={(d) => y(val(d))} yScale={y}
        curve={curveMonotoneX} fill={`url(#s${gid})`} />
      <LinePath data={data} x={(_, i) => x(i)} y={(d) => y(val(d))} curve={curveMonotoneX}
        stroke={color} strokeWidth={1.8} />
    </svg>
  );
}
