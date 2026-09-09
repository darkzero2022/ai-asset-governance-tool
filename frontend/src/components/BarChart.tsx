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
          <div className="mb-1 flex items-center justify-between text-xs text-subtle">
            <span>{item.label}</span>
            <span className="tabular-nums">{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-alt">
            <div
              className="h-full rounded-full bg-chart-1"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
      {!data.length && <p className="text-sm text-subtle">No data available.</p>}
    </div>
  );
}
