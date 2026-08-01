type AssetNode = { id: string; name: string; type: string };

type AssetDetail = {
  name: string;
  parentDependencies?: Array<{ childAsset: AssetNode }>;
  childDependencies?: Array<{ parentAsset: AssetNode }>;
};

export function DependencyGraph({ asset }: { asset: AssetDetail }) {
  return (
    <div className="mt-5 rounded-xl bg-slate-50 p-4">
      <h3 className="font-semibold">Dependency Graph</h3>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium text-slate-700">Depends on</p>
          {(asset.parentDependencies ?? []).map((link) => <p key={link.childAsset.id} className="mt-1 rounded bg-white px-3 py-2 ring-1 ring-slate-200">{link.childAsset.name} ({link.childAsset.type})</p>)}
          {!(asset.parentDependencies ?? []).length && <p className="mt-1 text-slate-500">No child dependencies declared.</p>}
        </div>
        <div>
          <p className="font-medium text-slate-700">Used by</p>
          {(asset.childDependencies ?? []).map((link) => <p key={link.parentAsset.id} className="mt-1 rounded bg-white px-3 py-2 ring-1 ring-slate-200">{link.parentAsset.name} ({link.parentAsset.type})</p>)}
          {!(asset.childDependencies ?? []).length && <p className="mt-1 text-slate-500">No parent assets declared.</p>}
        </div>
      </div>
    </div>
  );
}
