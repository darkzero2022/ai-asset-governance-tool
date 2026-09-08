import type { FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input, TextArea } from "./ui/Field";

export type ModelCardFormState = {
  approach: string;
  task: string;
  architectureFamily: string;
  modelArchitecture: string;
  datasetsDescription: string;
  inputsDescription: string;
  outputsDescription: string;
  intendedUsers: string;
  useCases: string;
  technicalLimitations: string;
  performanceTradeoffs: string;
  ethicalConsiderations: string;
  fairnessAssessments: string;
  environmentalConsiderations: string;
  performanceMetrics: string;
  metrics: ModelCardMetricFormState[];
};

export type ModelCardMetric = {
  id: string;
  metricName: string;
  metricValue: number;
  slice?: string | null;
  recordedAt?: string;
};

export type ModelCardMetricFormState = {
  id?: string;
  metricName: string;
  metricValue: string;
  slice: string;
};

export type ModelCard = Partial<Omit<ModelCardFormState, "performanceMetrics">> & {
  id?: string;
  performanceMetrics?: unknown;
  metrics?: ModelCardMetric[];
  completeness?: { percent: number; missingFields: string[] };
};

export type ModelCardCompleteness = { percent: number; missingFields: string[] };

type Props = {
  modelCard: ModelCard | null;
  completeness?: ModelCardCompleteness;
  form: ModelCardFormState;
  sourceUrl: string;
  importSuggestion: ImportSuggestion | null;
  onFormChange: (form: ModelCardFormState) => void;
  onSourceUrlChange: (sourceUrl: string) => void;
  onFetchImport: (sourceUrl: string) => void;
  onSubmit: (event: FormEvent) => void;
};

type ImportSuggestion = {
  sourceUrl: string;
  suggestedTitle: string;
  suggestedDescription: string;
  excerpt: string;
};

export const emptyModelCardForm: ModelCardFormState = {
  approach: "",
  task: "",
  architectureFamily: "",
  modelArchitecture: "",
  datasetsDescription: "",
  inputsDescription: "",
  outputsDescription: "",
  intendedUsers: "",
  useCases: "",
  technicalLimitations: "",
  performanceTradeoffs: "",
  ethicalConsiderations: "",
  fairnessAssessments: "",
  environmentalConsiderations: "",
  performanceMetrics: "",
  metrics: [],
};

export function modelCardToForm(modelCard: ModelCard | null): ModelCardFormState {
  return {
    approach: modelCard?.approach ?? "",
    task: modelCard?.task ?? "",
    architectureFamily: modelCard?.architectureFamily ?? "",
    modelArchitecture: modelCard?.modelArchitecture ?? "",
    datasetsDescription: modelCard?.datasetsDescription ?? "",
    inputsDescription: modelCard?.inputsDescription ?? "",
    outputsDescription: modelCard?.outputsDescription ?? "",
    intendedUsers: modelCard?.intendedUsers ?? "",
    useCases: modelCard?.useCases ?? "",
    technicalLimitations: modelCard?.technicalLimitations ?? "",
    performanceTradeoffs: modelCard?.performanceTradeoffs ?? "",
    ethicalConsiderations: modelCard?.ethicalConsiderations ?? "",
    fairnessAssessments: modelCard?.fairnessAssessments ?? "",
    environmentalConsiderations: modelCard?.environmentalConsiderations ?? "",
    performanceMetrics: modelCard?.performanceMetrics ? JSON.stringify(modelCard.performanceMetrics, null, 2) : "",
    metrics: (modelCard?.metrics ?? []).map((metric) => ({ id: metric.id, metricName: metric.metricName, metricValue: String(metric.metricValue), slice: metric.slice ?? "" })),
  };
}

export function ModelCardForm({ modelCard, completeness, form, sourceUrl, importSuggestion, onFormChange, onSourceUrlChange, onFetchImport, onSubmit }: Props) {
  const update = (key: keyof ModelCardFormState, value: string) => onFormChange({ ...form, [key]: value });
  const updateMetric = (index: number, key: keyof ModelCardMetricFormState, value: string) => onFormChange({
    ...form,
    metrics: form.metrics.map((metric, metricIndex) => metricIndex === index ? { ...metric, [key]: value } : metric),
  });
  const addMetric = () => onFormChange({ ...form, metrics: [...form.metrics, { metricName: "", metricValue: "", slice: "" }] });
  const removeMetric = (index: number) => onFormChange({ ...form, metrics: form.metrics.filter((_metric, metricIndex) => metricIndex !== index) });
  const displayCompleteness = completeness ?? modelCard?.completeness;

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">Model Card</h3>
          <p className="text-sm text-subtle">Required before approving or deploying MODEL and SERVICE AI systems.</p>
        </div>
        {displayCompleteness && <Badge variant="primary">{displayCompleteness.percent}% complete</Badge>}
      </div>
      {displayCompleteness?.missingFields?.length ? <p className="mt-3 text-sm text-warning">Missing: {displayCompleteness.missingFields.join(", ")}</p> : null}
      <div className="mt-4 rounded-md border border-border p-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><Input label="Import from URL" value={sourceUrl} onChange={(event) => onSourceUrlChange(event.target.value)} /></div>
          <Button type="button" variant="secondary" className="self-end" disabled={!sourceUrl} onClick={() => onFetchImport(sourceUrl)}>Fetch</Button>
        </div>
        {importSuggestion && <ImportPreview suggestion={importSuggestion} />}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Input label="Task" value={form.task} onChange={(event) => update("task", event.target.value)} />
        <Input label="Approach" value={form.approach} onChange={(event) => update("approach", event.target.value)} />
        <Input label="Architecture Family" value={form.architectureFamily} onChange={(event) => update("architectureFamily", event.target.value)} />
        <Input label="Model Architecture" value={form.modelArchitecture} onChange={(event) => update("modelArchitecture", event.target.value)} />
        <TextArea label="Datasets" value={form.datasetsDescription} onChange={(event) => update("datasetsDescription", event.target.value)} />
        <TextArea label="Inputs" value={form.inputsDescription} onChange={(event) => update("inputsDescription", event.target.value)} />
        <TextArea label="Outputs" value={form.outputsDescription} onChange={(event) => update("outputsDescription", event.target.value)} />
        <TextArea label="Intended Users" value={form.intendedUsers} onChange={(event) => update("intendedUsers", event.target.value)} />
        <TextArea label="Use Cases" value={form.useCases} onChange={(event) => update("useCases", event.target.value)} />
        <TextArea label="Technical Limitations" value={form.technicalLimitations} onChange={(event) => update("technicalLimitations", event.target.value)} />
        <TextArea label="Performance Tradeoffs" value={form.performanceTradeoffs} onChange={(event) => update("performanceTradeoffs", event.target.value)} />
        <TextArea label="Ethical Considerations" value={form.ethicalConsiderations} onChange={(event) => update("ethicalConsiderations", event.target.value)} />
        <TextArea label="Fairness Assessments" value={form.fairnessAssessments} onChange={(event) => update("fairnessAssessments", event.target.value)} />
        <TextArea label="Environmental Considerations" value={form.environmentalConsiderations} onChange={(event) => update("environmentalConsiderations", event.target.value)} />
        <TextArea label="Performance Metrics JSON" value={form.performanceMetrics} onChange={(event) => update("performanceMetrics", event.target.value)} className="font-mono text-xs" />
      </div>
      <div className="mt-5 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-text">Structured Metrics</h4>
            <p className="text-sm text-subtle">Use normalized rows for cross-model dashboard comparisons.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={addMetric}>Add metric</Button>
        </div>
        <div className="mt-3 space-y-3">
          {form.metrics.map((metric, index) => (
            <div key={metric.id ?? index} className="grid gap-2 md:grid-cols-[1fr_0.6fr_1fr_auto]">
              <Input label="Metric Name" value={metric.metricName} onChange={(event) => updateMetric(index, "metricName", event.target.value)} />
              <Input label="Value" value={metric.metricValue} onChange={(event) => updateMetric(index, "metricValue", event.target.value)} />
              <Input label="Slice" value={metric.slice} onChange={(event) => updateMetric(index, "slice", event.target.value)} />
              <Button type="button" variant="danger" size="sm" className="self-end" onClick={() => removeMetric(index)} aria-label="Remove metric">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!form.metrics.length && <p className="text-sm text-subtle">No structured metrics yet.</p>}
        </div>
      </div>
      <Button type="submit" variant="primary" className="mt-5">Save Model Card</Button>
    </form>
  );
}

function ImportPreview(props: { suggestion: ImportSuggestion }) {
  return (
    <div className="mt-3 rounded-md bg-surface-alt p-3 text-xs text-subtle ring-1 ring-border">
      <p className="font-semibold text-text">Fetched suggestion</p>
      <p className="mt-1"><span className="font-medium text-text">Title:</span> {props.suggestion.suggestedTitle || "Not found"}</p>
      <p className="mt-1"><span className="font-medium text-text">Description:</span> {props.suggestion.suggestedDescription || "Not found"}</p>
      <p className="mt-1"><span className="font-medium text-text">Excerpt:</span> {props.suggestion.excerpt || "Not found"}</p>
    </div>
  );
}
