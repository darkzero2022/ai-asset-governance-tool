import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApprovalBanner } from "./ApprovalBanner";
import { BarChart } from "./BarChart";
import { RiskHeatmap } from "./RiskHeatmap";
import { SeverityBadge } from "./ui/Badge";
import RiskRegister from "../pages/RiskRegister";
import { emptyRisk, emptyFilters, label } from "../formDefaults";

describe("SeverityBadge", () => {
  it("renders severity labels with a color-coded variant", () => {
    const { rerender } = render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();

    rerender(<SeverityBadge severity={null} />);
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });
});

describe("ApprovalBanner", () => {
  it("shows a success state when no risks or model card fields block approval", () => {
    render(<ApprovalBanner assetType="DATASET" risks={[]} />);

    expect(screen.getByText(/no open high or critical risks/i)).toBeInTheDocument();
  });

  it("shows high-risk and Model Card completeness blockers", () => {
    render(
      <ApprovalBanner
        assetType="MODEL"
        modelCardCompleteness={{ missingFields: ["task", "architecture"] }}
        risks={[{ id: "risk-1", description: "Prompt injection", status: "OPEN", inherentRiskScore: 12, severity: "HIGH" }]}
      />,
    );

    expect(screen.getByText("Approval/deployment blocked")).toBeInTheDocument();
    expect(screen.getByText("Prompt injection (12)")).toBeInTheDocument();
    expect(screen.getByText("Model Card incomplete: task, architecture")).toBeInTheDocument();
  });
});

describe("BarChart", () => {
  it("applies per-datum color overrides", () => {
    const { container } = render(<BarChart data={[{ label: "Missing", value: 0, color: "#f59e0b" }, { label: "Covered", value: 4 }]} />);
    const bars = container.querySelectorAll(".h-full.rounded-full");

    expect(bars[0]).toHaveStyle({ backgroundColor: "#f59e0b" });
    expect(bars[1]).not.toHaveStyle({ backgroundColor: "#f59e0b" });
  });
});

describe("RiskRegister — MITRE ATLAS mitigations", () => {
  const baseProps = {
    risks: [],
    assets: [{ id: "a1", name: "Claims Model" }],
    categories: [
      { framework: "OWASP_LLM_TOP10", categoryId: "LLM01", name: "Prompt Injection" },
      { framework: "OWASP_MCP_TOP10", categoryId: "MCP06", name: "Prompt Injection via Contextual Payloads" },
    ],
    frameworks: [
      { framework: "OWASP_LLM_TOP10", title: "OWASP LLM Top 10", revision: "2025", status: "RELEASED" },
      { framework: "OWASP_MCP_TOP10", title: "OWASP MCP Top 10", revision: "Draft v0.1 (2025)", status: "DRAFT" },
    ],
    atlasTechniques: ["LLM Prompt Injection"],
    atlasMitigations: ["AML.M0000 — Limit Public Release of Information", "AML.M0020 — Generative AI Guardrails"],
    filters: emptyFilters,
    editingRiskId: null,
    dialogOpen: true,
    selectedRiskIds: [],
    label,
    onFiltersChange: vi.fn(),
    onSubmitRisk: vi.fn(),
    onNewRisk: vi.fn(),
    onDialogOpenChange: vi.fn(),
    onEditRisk: vi.fn(),
    onOpenRisk: vi.fn(),
    onToggleRisk: vi.fn(),
    onBulkUpdate: vi.fn(),
    canManage: true,
  };

  it("lists the mitigation catalogue and toggles a selection through onRiskFormChange", () => {
    const onRiskFormChange = vi.fn();
    render(
      <MemoryRouter>
        <RiskRegister {...baseProps} riskForm={{ ...emptyRisk }} onRiskFormChange={onRiskFormChange} />
      </MemoryRouter>,
    );

    const guardrails = screen.getByLabelText("AML.M0020 — Generative AI Guardrails") as HTMLInputElement;
    expect(guardrails.checked).toBe(false);
    fireEvent.click(guardrails);
    expect(onRiskFormChange).toHaveBeenCalledWith(
      expect.objectContaining({ atlasMitigations: ["AML.M0020 — Generative AI Guardrails"] }),
    );
  });

  it("reflects an already-selected mitigation as checked", () => {
    render(
      <MemoryRouter>
        <RiskRegister
          {...baseProps}
          riskForm={{ ...emptyRisk, atlasMitigations: ["AML.M0000 — Limit Public Release of Information"] }}
          onRiskFormChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    const checked = screen.getByLabelText("AML.M0000 — Limit Public Release of Information") as HTMLInputElement;
    expect(checked.checked).toBe(true);
    expect(within(document.body).getByText("1 selected")).toBeInTheDocument();
  });

  it("offers OWASP MCP Top 10 as a framework and marks it draft", () => {
    render(
      <MemoryRouter>
        <RiskRegister {...baseProps} riskForm={{ ...emptyRisk }} onRiskFormChange={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole("option", { name: "OWASP MCP Top 10 (draft)" }).length).toBeGreaterThan(0);
  });
});

describe("RiskHeatmap", () => {
  it("colors populated cells by severity band and invokes the click callback", () => {
    const onCellClick = vi.fn();
    render(<RiskHeatmap risks={[{ id: "risk-1", likelihood: 5, impact: 4 }]} onCellClick={onCellClick} />);

    const criticalCell = screen.getByRole("button", { name: "Likelihood 5, impact 4: 1 risk" });
    expect(criticalCell).toHaveStyle({ color: "#ffffff" });

    fireEvent.click(criticalCell);
    expect(onCellClick).toHaveBeenCalledWith({ likelihood: 5, impact: 4 });
  });
});
