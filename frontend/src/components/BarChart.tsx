type BarDatum = {
  label: string;
  value: number;
  color?: string;
};

export function BarChart({ data }: { data: BarDatum[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-cyan-600" style={{ width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`, backgroundColor: item.color }} />
          </div>
        </div>
      ))}
      {!data.length && <p className="text-sm text-slate-500">No data available.</p>}
    </div>
  );
}
