import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalBanner } from "./ApprovalBanner";
import { BarChart } from "./BarChart";
import { RiskHeatmap } from "./RiskHeatmap";
import { SeverityBadge } from "./SeverityBadge";

describe("SeverityBadge", () => {
  it("renders severity labels with mapped color classes", () => {
    const { rerender } = render(<SeverityBadge severity="CRITICAL" />);

    expect(screen.getByText("CRITICAL")).toHaveClass("bg-red-50", "text-red-700");

    rerender(<SeverityBadge severity={null} />);
    expect(screen.getByText("UNKNOWN")).toHaveClass("bg-slate-50", "text-slate-600");
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

describe("RiskHeatmap", () => {
  it("colors populated cells by severity band and invokes the click callback", () => {
    const onCellClick = vi.fn();
    render(<RiskHeatmap risks={[{ id: "risk-1", likelihood: 5, impact: 4 }]} onCellClick={onCellClick} />);

    const criticalCell = screen.getByRole("button", { name: "1" });
    expect(criticalCell).toHaveClass("bg-red-300", "text-red-950");

    fireEvent.click(criticalCell);
    expect(onCellClick).toHaveBeenCalledWith({ likelihood: 5, impact: 4 });
  });
});
