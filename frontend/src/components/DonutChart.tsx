type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

export function DonutChart({ data }: { data: DonutDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-32 w-32 -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="transparent" className="stroke-border" strokeWidth="6" />
        {total > 0 && data.map((item) => {
          const dash = (item.value / total) * 100;
          const circle = <circle key={item.label} cx="21" cy="21" r="15.915" fill="transparent" stroke={item.color} strokeWidth="6" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={offset} />;
          offset -= dash;
          return circle;
        })}
      </svg>
      <div className="space-y-2 text-sm">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-subtle">{item.label}</span>
            <span className="font-semibold text-text tabular-nums">{item.value}</span>
          </div>
        ))}
        {!data.length && <p className="text-subtle">No data available.</p>}
      </div>
    </div>
  );
}
