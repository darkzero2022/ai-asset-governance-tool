import type { ThreatModelElementType } from "@aibom/shared";

type Element = {
  id: string;
  type: ThreatModelElementType;
  name: string;
  description: string | null;
  trustBoundaryId: string | null;
  x: number | null;
  y: number | null;
};
type Flow = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  protocol: string | null;
  authenticated: boolean;
  encrypted: boolean;
};
type Boundary = { id: string; name: string; description: string | null };
type Threat = {
  id: string;
  title: string;
  description: string;
  strideAiCategory: string | null;
  sourceFramework: string | null;
  sourceCategoryId: string | null;
  status: string;
  elementId: string | null;
  flowId: string | null;
  promotedRiskId: string | null;
};
type Model = {
  id: string;
  title: string;
  description: string | null;
  elements: Element[];
  flows: Flow[];
  trustBoundaries: Boundary[];
  threats: Threat[];
};

// Left-to-right data-flow columns. Anything unlisted lands in the middle.
const COLUMN: Record<ThreatModelElementType, number> = {
  EXTERNAL_DATA_SOURCE: 0,
  TRAINING_DATASET: 0,
  END_USER: 0,
  VECTOR_STORE: 1,
  DATA_STORE: 1,
  TOOL_MCP_SERVER: 1,
  INFERENCE_API: 2,
  PROCESS: 2,
  MODEL: 3,
  HUMAN_REVIEWER: 4,
  DOWNSTREAM_CONSUMER: 5,
};

const NODE_W = 150;
const NODE_H = 60;
const COL_GAP = 90;
const ROW_GAP = 30;
const PAD = 40;

export type ThreatModelReport = ReturnType<typeof buildThreatModelReport>;

/** Assemble a report: an auto-laid-out DFD plus grouped threat tables. */
export function buildThreatModelReport(model: Model) {
  const columns = new Map<number, Element[]>();
  for (const el of model.elements) {
    const col = COLUMN[el.type] ?? 3;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(el);
  }

  const positioned = new Map<string, { x: number; y: number }>();
  for (const [col, els] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    els.forEach((el, row) => {
      positioned.set(el.id, {
        x: el.x ?? PAD + col * (NODE_W + COL_GAP),
        y: el.y ?? PAD + row * (NODE_H + ROW_GAP),
      });
    });
  }

  const maxX = Math.max(PAD, ...[...positioned.values()].map((p) => p.x + NODE_W));
  const maxY = Math.max(PAD, ...[...positioned.values()].map((p) => p.y + NODE_H));

  const elementById = new Map(model.elements.map((e) => [e.id, e]));

  const nodes = model.elements.map((el) => ({
    id: el.id,
    type: el.type,
    name: el.name,
    description: el.description,
    trustBoundaryId: el.trustBoundaryId,
    x: positioned.get(el.id)!.x,
    y: positioned.get(el.id)!.y,
    width: NODE_W,
    height: NODE_H,
  }));

  const edges = model.flows.map((f) => {
    const s = elementById.get(f.sourceId);
    const t = elementById.get(f.targetId);
    return {
      id: f.id,
      sourceId: f.sourceId,
      targetId: f.targetId,
      label: f.label,
      protocol: f.protocol,
      authenticated: f.authenticated,
      encrypted: f.encrypted,
      crossesBoundary: (s?.trustBoundaryId ?? null) !== (t?.trustBoundaryId ?? null),
    };
  });

  const byStatus = (status: string) => model.threats.filter((t) => t.status === status);

  return {
    threatModelId: model.id,
    title: model.title,
    description: model.description,
    summary: {
      elements: model.elements.length,
      flows: model.flows.length,
      trustBoundaries: model.trustBoundaries.length,
      threats: model.threats.length,
      suggested: byStatus("SUGGESTED").length,
      accepted: byStatus("ACCEPTED").length,
      dismissed: byStatus("DISMISSED").length,
      promoted: byStatus("PROMOTED").length,
      crossBoundaryFlows: edges.filter((e) => e.crossesBoundary).length,
    },
    diagram: {
      width: maxX + PAD,
      height: maxY + PAD,
      nodes,
      edges,
      boundaries: model.trustBoundaries.map((b) => {
        const members = nodes.filter((n) => n.trustBoundaryId === b.id);
        if (members.length === 0) return { ...b, box: null };
        const x0 = Math.min(...members.map((m) => m.x)) - 16;
        const y0 = Math.min(...members.map((m) => m.y)) - 24;
        const x1 = Math.max(...members.map((m) => m.x + m.width)) + 16;
        const y1 = Math.max(...members.map((m) => m.y + m.height)) + 16;
        return { ...b, box: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } };
      }),
    },
    threats: {
      suggested: byStatus("SUGGESTED"),
      accepted: byStatus("ACCEPTED"),
      promoted: byStatus("PROMOTED"),
      dismissed: byStatus("DISMISSED"),
    },
  };
}
