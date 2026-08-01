type Risk = { id: string; likelihood: number; impact: number };

type Props = {
  risks: Risk[];
  onCellClick?: (filter: { likelihood: number; impact: number }) => void;
};

export function RiskHeatmap({ risks, onCellClick }: Props) {
  const count = (likelihood: number, impact: number) => risks.filter((risk) => risk.likelihood === likelihood && risk.impact === impact).length;

  return (
    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h3 className="font-semibold">Likelihood x Impact</h3>
      <div className="mt-3 grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1 text-center text-xs">
        <div className="flex items-center justify-center text-[10px] uppercase tracking-wide text-slate-500">Impact</div>
        {[1, 2, 3, 4, 5].map((likelihood) => <div key={likelihood} className="text-[10px] text-slate-500">L{likelihood}</div>)}
        {[5, 4, 3, 2, 1].flatMap((impact) => [
          <div key={`impact-${impact}`} className="flex items-center justify-center text-[10px] text-slate-500">I{impact}</div>,
          ...[1, 2, 3, 4, 5].map((likelihood) => {
            const total = count(likelihood, impact);
            const score = likelihood * impact;
            return (
              <button key={`${likelihood}-${impact}`} className={`rounded p-2 font-semibold ${cellClass(score, total)}`} onClick={() => onCellClick?.({ likelihood, impact })}>
                {total}
              </button>
            );
          }),
        ])}
        <div />
        <div className="col-span-5 text-[10px] uppercase tracking-wide text-slate-500">Likelihood</div>
      </div>
    </div>
  );
}

function cellClass(score: number, count: number) {
  if (!count) return "bg-slate-800 text-slate-500 hover:bg-slate-700";
  if (score >= 20) return "bg-red-300 text-red-950 hover:bg-red-200";
  if (score >= 12) return "bg-orange-300 text-orange-950 hover:bg-orange-200";
  if (score >= 6) return "bg-amber-300 text-amber-950 hover:bg-amber-200";
  return "bg-emerald-300 text-emerald-950 hover:bg-emerald-200";
}
