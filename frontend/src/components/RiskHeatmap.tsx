import { cn } from "../lib/cn";

type Risk = { id: string; likelihood: number; impact: number };

type Props = {
  risks: Risk[];
  onCellClick?: (filter: { likelihood: number; impact: number }) => void;
};

// Mirrors theme/tokens.css's --wz-heat-* stops (score 1 -> 25); same values
// in both themes, so hardcoding them here for interpolation math is safe.
const HEAT_STOPS: Array<[number, [number, number, number]]> = [
  [1, [29, 165, 132]],
  [6, [127, 191, 63]],
  [12, [245, 167, 0]],
  [18, [224, 98, 30]],
  [25, [179, 34, 23]],
];

function heatColor(score: number): string {
  const clamped = Math.min(Math.max(score, 1), 25);
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [fromScore, fromColor] = HEAT_STOPS[i];
    const [toScore, toColor] = HEAT_STOPS[i + 1];
    if (clamped >= fromScore && clamped <= toScore) {
      const t = (clamped - fromScore) / (toScore - fromScore);
      const rgb = fromColor.map((channel, index) =>
        Math.round(channel + (toColor[index] - channel) * t),
      );
      return `rgb(${rgb.join(" ")})`;
    }
  }
  return `rgb(${HEAT_STOPS[HEAT_STOPS.length - 1][1].join(" ")})`;
}

// Auto-contrast: light text on the dark/saturated (orange-red) end, dark
// text on the light (green/amber) end — color is never the only signal, the
// count is always printed too.
function textColorFor(score: number): string {
  return score >= 12 ? "#ffffff" : "#0b1220";
}

export function RiskHeatmap({ risks, onCellClick }: Props) {
  const count = (likelihood: number, impact: number) =>
    risks.filter((risk) => risk.likelihood === likelihood && risk.impact === impact).length;

  return (
    <div className="mt-5 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text">Likelihood × Impact</h3>
      <div className="mt-3 grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-center text-xs">
        <div className="flex items-center justify-center text-[10px] uppercase tracking-wide text-subtle">
          Impact
        </div>
        {[1, 2, 3, 4, 5].map((likelihood) => (
          <div key={likelihood} className="text-[10px] text-subtle">
            L{likelihood}
          </div>
        ))}
        {[5, 4, 3, 2, 1].flatMap((impact) => [
          <div
            key={`impact-${impact}`}
            className="flex items-center justify-center text-[10px] text-subtle"
          >
            I{impact}
          </div>,
          ...[1, 2, 3, 4, 5].map((likelihood) => {
            const total = count(likelihood, impact);
            const score = likelihood * impact;
            return (
              <button
                key={`${likelihood}-${impact}`}
                className={cn(
                  "rounded p-2 font-semibold transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  !total && "bg-surface-alt",
                )}
                style={
                  total
                    ? { backgroundColor: heatColor(score), color: textColorFor(score) }
                    : undefined
                }
                aria-label={`Likelihood ${likelihood}, impact ${impact}: ${total} risk${total === 1 ? "" : "s"}`}
                onClick={() => onCellClick?.({ likelihood, impact })}
              >
                <span className={!total ? "text-disabled" : undefined}>{total}</span>
              </button>
            );
          }),
        ])}
        <div />
        <div className="col-span-5 text-[10px] uppercase tracking-wide text-subtle">Likelihood</div>
      </div>
    </div>
  );
}
