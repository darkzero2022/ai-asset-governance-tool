import type { FormEvent } from "react";

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
    <form onSubmit={onSubmit} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Model Card</h3>
          <p className="text-sm text-slate-500">Required before approving or deploying MODEL and SERVICE assets.</p>
        </div>
        {displayCompleteness && <span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-semibold text-cyan-700 ring-1 ring-cyan-100">{displayCompleteness.percent}% complete</span>}
      </div>
      {displayCompleteness?.missingFields?.length ? <p className="mt-3 text-sm text-amber-700">Missing: {displayCompleteness.missingFields.join(", ")}</p> : null}
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><Field label="Import from URL" value={sourceUrl} onChange={onSourceUrlChange} /></div>
          <button type="button" className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40" disabled={!sourceUrl} onClick={() => onFetchImport(sourceUrl)}>Fetch</button>
        </div>
        {importSuggestion && <ImportPreview suggestion={importSuggestion} />}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Task" value={form.task} onChange={(value) => update("task", value)} />
        <Field label="Approach" value={form.approach} onChange={(value) => update("approach", value)} />
        <Field label="Architecture Family" value={form.architectureFamily} onChange={(value) => update("architectureFamily", value)} />
        <Field label="Model Architecture" value={form.modelArchitecture} onChange={(value) => update("modelArchitecture", value)} />
        <TextArea label="Datasets" value={form.datasetsDescription} onChange={(value) => update("datasetsDescription", value)} />
        <TextArea label="Inputs" value={form.inputsDescription} onChange={(value) => update("inputsDescription", value)} />
        <TextArea label="Outputs" value={form.outputsDescription} onChange={(value) => update("outputsDescription", value)} />
        <TextArea label="Intended Users" value={form.intendedUsers} onChange={(value) => update("intendedUsers", value)} />
        <TextArea label="Use Cases" value={form.useCases} onChange={(value) => update("useCases", value)} />
        <TextArea label="Technical Limitations" value={form.technicalLimitations} onChange={(value) => update("technicalLimitations", value)} />
        <TextArea label="Performance Tradeoffs" value={form.performanceTradeoffs} onChange={(value) => update("performanceTradeoffs", value)} />
        <TextArea label="Ethical Considerations" value={form.ethicalConsiderations} onChange={(value) => update("ethicalConsiderations", value)} />
        <TextArea label="Fairness Assessments" value={form.fairnessAssessments} onChange={(value) => update("fairnessAssessments", value)} />
        <TextArea label="Environmental Considerations" value={form.environmentalConsiderations} onChange={(value) => update("environmentalConsiderations", value)} />
        <TextArea label="Performance Metrics JSON" value={form.performanceMetrics} onChange={(value) => update("performanceMetrics", value)} />
      </div>
      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold">Structured Metrics</h4>
            <p className="text-sm text-slate-500">Use normalized rows for cross-model dashboard comparisons.</p>
          </div>
          <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={addMetric}>Add metric</button>
        </div>
        <div className="mt-3 space-y-3">
          {form.metrics.map((metric, index) => (
            <div key={metric.id ?? index} className="grid gap-2 md:grid-cols-[1fr_0.6fr_1fr_auto]">
              <Field label="Metric Name" value={metric.metricName} onChange={(value) => updateMetric(index, "metricName", value)} />
              <Field label="Value" value={metric.metricValue} onChange={(value) => updateMetric(index, "metricValue", value)} />
              <Field label="Slice" value={metric.slice} onChange={(value) => updateMetric(index, "slice", value)} />
              <button type="button" className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => removeMetric(index)}>Remove</button>
            </div>
          ))}
          {!form.metrics.length && <p className="text-sm text-slate-500">No structured metrics yet.</p>}
        </div>
      </div>
      <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save Model Card</button>
    </form>
  );
}

function ImportPreview(props: { suggestion: ImportSuggestion }) {
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
      <p className="font-semibold text-slate-800">Fetched suggestion</p>
      <p className="mt-1"><span className="font-medium">Title:</span> {props.suggestion.suggestedTitle || "Not found"}</p>
      <p className="mt-1"><span className="font-medium">Description:</span> {props.suggestion.suggestedDescription || "Not found"}</p>
      <p className="mt-1"><span className="font-medium">Excerpt:</span> {props.suggestion.excerpt || "Not found"}</p>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{props.label}<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}

function TextArea(props: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{props.label}<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}
