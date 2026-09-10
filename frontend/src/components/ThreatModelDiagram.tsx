import type { ThreatModelReport } from "../queries/threatModels";

const TYPE_LABEL: Record<string, string> = {
  MODEL: "Model",
  TRAINING_DATASET: "Training data",
  INFERENCE_API: "Inference API",
  VECTOR_STORE: "Vector store",
  TOOL_MCP_SERVER: "MCP tool",
  EXTERNAL_DATA_SOURCE: "External source",
  END_USER: "End user",
  DOWNSTREAM_CONSUMER: "Consumer",
  HUMAN_REVIEWER: "Human reviewer",
  DATA_STORE: "Data store",
  PROCESS: "Process",
};

// Elements that are actors/stores render with a distinct shape hint via colour.
const ACCENT: Record<string, string> = {
  MODEL: "var(--wz-primary, #2f6fed)",
  END_USER: "#8a8f98",
  EXTERNAL_DATA_SOURCE: "#8a8f98",
  DOWNSTREAM_CONSUMER: "#8a8f98",
  TOOL_MCP_SERVER: "#b4690e",
};

export function ThreatModelDiagram({ diagram }: { diagram: ThreatModelReport["diagram"] }) {
  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  const center = (id: string) => {
    const n = nodeById.get(id);
    return n ? { x: n.x + n.width / 2, y: n.y + n.height / 2 } : { x: 0, y: 0 };
  };

  if (diagram.nodes.length === 0) {
    return <p className="text-sm text-subtle">Add elements and flows to see the diagram.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${diagram.width} ${diagram.height}`}
        width={diagram.width}
        height={diagram.height}
        className="max-w-full"
        role="img"
        aria-label="Data-flow diagram"
      >
        <defs>
          <marker
            id="tm-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>

        {diagram.boundaries.map((b) =>
          b.box ? (
            <g key={b.id}>
              <rect
                x={b.box.x}
                y={b.box.y}
                width={b.box.width}
                height={b.box.height}
                fill="none"
                stroke="#b4690e"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                rx={8}
              />
              <text x={b.box.x + 6} y={b.box.y + 14} fontSize={11} fill="#b4690e">
                {b.name}
              </text>
            </g>
          ) : null,
        )}

        {diagram.edges.map((e) => {
          const a = center(e.sourceId);
          const z = center(e.targetId);
          const mid = { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 };
          const color = e.crossesBoundary ? "#c0392b" : "#6b7280";
          return (
            <g key={e.id} style={{ color }}>
              <line
                x1={a.x}
                y1={a.y}
                x2={z.x}
                y2={z.y}
                stroke="currentColor"
                strokeWidth={1.5}
                markerEnd="url(#tm-arrow)"
              />
              <text x={mid.x} y={mid.y - 4} fontSize={10} fill="currentColor" textAnchor="middle">
                {e.label}
                {!e.authenticated ? " · unauth" : ""}
                {!e.encrypted ? " · plaintext" : ""}
              </text>
            </g>
          );
        })}

        {diagram.nodes.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={n.width}
              height={n.height}
              rx={6}
              fill="var(--wz-surface, #fff)"
              stroke={ACCENT[n.type] ?? "#8a8f98"}
              strokeWidth={n.type === "MODEL" ? 2 : 1.25}
            />
            <text x={n.x + 8} y={n.y + 16} fontSize={9} fill="#8a8f98">
              {TYPE_LABEL[n.type] ?? n.type}
            </text>
            <text
              x={n.x + 8}
              y={n.y + 36}
              fontSize={12}
              fontWeight={600}
              fill="var(--wz-text, #111)"
            >
              {n.name.length > 18 ? `${n.name.slice(0, 17)}…` : n.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
