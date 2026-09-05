type Asset = {
  id: string;
  name: string;
  version: string;
  type: string;
  supplier: string;
  hostingModel: string;
  status: string;
  updatedAt?: string;
  _count?: { risks: number };
  projectUsageCount?: number;
};

type AssetTableProps = {
  assets: Asset[];
  label: (value: string) => string;
  onSelect: (id: string) => void;
  onEdit?: (asset: any) => void;
  onExport: (id: string) => void;
};

export function AssetTable({ assets, label, onSelect, onEdit, onExport }: AssetTableProps) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr><th className="py-3">Name</th><th>Type</th><th>Supplier</th><th>Status</th><th>Risks</th><th>Projects</th><th></th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {assets.map((asset) => (
            <tr key={asset.id}>
              <td className="py-4 font-medium"><button className="text-left hover:text-cyan-700" onClick={() => onSelect(asset.id)}>{asset.name}</button><span className="block text-xs text-slate-500">v{asset.version} | {label(asset.hostingModel)}</span></td>
              <td>{label(asset.type)}</td>
              <td>{asset.supplier}</td>
              <td><span className="rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">{label(asset.status)}</span></td>
              <td>{asset._count?.risks ?? 0}</td>
              <td>{asset.projectUsageCount ?? 0}</td>
              <td className="space-x-3 text-right">{onEdit && <button className="font-semibold text-slate-700" onClick={() => onEdit(asset)}>Edit</button>}<button className="font-semibold text-cyan-700" onClick={() => onExport(asset.id)}>Export</button></td>
            </tr>
          ))}
          {assets.length === 0 && <tr><td className="py-8 text-center text-slate-500" colSpan={7}>No assets match the current filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
