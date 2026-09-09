type AssetNode = { id: string; name: string; type: string };

type AssetDetail = {
  name: string;
  parentDependencies?: Array<{ childAsset: AssetNode }>;
  childDependencies?: Array<{ parentAsset: AssetNode }>;
};

export function DependencyGraph({ asset }: { asset: AssetDetail }) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text">Dependency Graph</h3>
      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium text-text">Depends on</p>
          {(asset.parentDependencies ?? []).map((link) => (
            <p
              key={link.childAsset.id}
              className="mt-1 rounded-md bg-surface-alt px-3 py-2 text-text ring-1 ring-border"
            >
              {link.childAsset.name} ({link.childAsset.type})
            </p>
          ))}
          {!(asset.parentDependencies ?? []).length && (
            <p className="mt-1 text-subtle">No child dependencies declared.</p>
          )}
        </div>
        <div>
          <p className="font-medium text-text">Used by</p>
          {(asset.childDependencies ?? []).map((link) => (
            <p
              key={link.parentAsset.id}
              className="mt-1 rounded-md bg-surface-alt px-3 py-2 text-text ring-1 ring-border"
            >
              {link.parentAsset.name} ({link.parentAsset.type})
            </p>
          ))}
          {!(asset.childDependencies ?? []).length && (
            <p className="mt-1 text-subtle">No parent assets declared.</p>
          )}
        </div>
      </div>
    </div>
  );
}
