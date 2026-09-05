import { FormEvent, lazy, useEffect, useState } from "react";
import { createBrowserRouter, Navigate, useNavigate, useOutletContext, useParams, useRouteError } from "react-router-dom";
import type { Asset, Project, Risk } from "@aibom/shared";
import App, { type AppOutletContext } from "./App";
import { emptyAsset, emptyFilters, emptyProject, emptyRisk, type ImportSuggestion, label, nextStatuses, type ProjectForm } from "./formDefaults";
import { emptyModelCardForm, modelCardToForm, type ModelCardFormState } from "./components/ModelCardForm";
import { useAuditLogsQuery } from "./queries/auditLogs";
import {
  useAssetProjectLinkMutations,
  useAssetProjectsQuery,
  useAssetQuery,
  useAssetRiskLinkMutations,
  useAssetsQuery,
  useExportCycloneDxMutation,
  useAssetModelCardQuery,
  useImportUrlMutation,
  useModelCardMetricMutations,
  useSaveAssetMutation,
  useSaveModelCardMutation,
  useTransitionAssetMutation,
} from "./queries/assets";
import { useControlsQuery } from "./queries/controls";
import {
  useExportProjectCycloneDxMutation,
  useProjectAssetLinkMutations,
  useProjectQuery,
  useProjectRiskLinkMutations,
  useProjectRisksQuery,
  useProjectsQuery,
  useSaveProjectMutation,
} from "./queries/projects";
import { useAtlasTechniquesQuery, useFrameworkCategoriesQuery } from "./queries/reference";
import {
  useBulkUpdateRisksMutation,
  useRiskAssetLinkMutations,
  useRiskControlLinkMutations,
  useRiskProjectLinkMutations,
  useRiskQuery,
  useRisksQuery,
  useSaveRiskMutation,
} from "./queries/risks";

// Route-level code splitting: each page becomes its own chunk, fetched only
// when its route is visited, instead of all eight shipping in the one
// initial bundle. App (the root layout, always needed) stays a static import.
const AssetDetail = lazy(() => import("./pages/AssetDetail"));
const AssetList = lazy(() => import("./pages/AssetList"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectList = lazy(() => import("./pages/ProjectList"));
const RiskDetail = lazy(() => import("./pages/RiskDetail"));
const RiskRegister = lazy(() => import("./pages/RiskRegister"));
const Users = lazy(() => import("./pages/Users"));

/**
 * Each route component below owns its page's server data via TanStack Query
 * (D2) instead of reading it off the outlet context — only the genuinely
 * cross-cutting bits (token, currentUser, the shared error banner) come from
 * App's context. Mutations invalidate the query keys they affect; there is
 * no more central loadData()/loadAsset() to call after a write.
 */

function useCtx() {
  return useOutletContext<AppOutletContext>();
}

function reportError(setError: (message: string) => void, err: unknown, fallback: string) {
  setError(err instanceof Error ? err.message : fallback);
}

function DashboardRoute() {
  const ctx = useCtx();
  return <Dashboard token={ctx.token} />;
}

function UsersRoute() {
  const ctx = useCtx();
  if (ctx.currentUser?.role !== "ADMIN") {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Admin access required.</div>
      </section>
    );
  }
  return <Users token={ctx.token} />;
}

function AssetListRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editBaseVersion, setEditBaseVersion] = useState<string | null>(null);
  const [importSuggestion, setImportSuggestion] = useState<ImportSuggestion | null>(null);

  const { data: assets = [] } = useAssetsQuery(ctx.token, filters);
  const saveAsset = useSaveAssetMutation(ctx.token);
  const importUrl = useImportUrlMutation(ctx.token);
  const exportCycloneDx = useExportCycloneDxMutation(ctx.token);

  function resetForm() {
    setAssetForm(emptyAsset);
    setEditingAssetId(null);
    setEditBaseVersion(null);
  }

  function onEdit(asset: Asset) {
    setEditingAssetId(asset.id);
    setEditBaseVersion(asset.updatedAt ?? null);
    setAssetForm({
      name: asset.name,
      version: asset.version,
      type: asset.type,
      supplier: asset.supplier,
      provider: asset.provider ?? "",
      hostingModel: asset.hostingModel,
      networkDependency: asset.networkDependency,
      license: asset.license ?? "",
      dataClassificationTouched: asset.dataClassificationTouched ?? "",
      trainingDataProvenance: asset.trainingDataProvenance ?? "",
      downstreamConsumers: asset.downstreamConsumers ?? "",
      sourceUrl: asset.sourceUrl ?? "",
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    ctx.setError("");
    try {
      const payload = editingAssetId && editBaseVersion ? { ...assetForm, expectedUpdatedAt: editBaseVersion } : assetForm;
      await saveAsset.mutateAsync({ id: editingAssetId ?? undefined, payload });
      resetForm();
    } catch (err) {
      reportError(ctx.setError, err, "Asset save failed");
    }
  }

  function onFetchImport(sourceUrl: string) {
    ctx.setError("");
    setAssetForm((current) => ({ ...current, sourceUrl }));
    setImportSuggestion(null);
    importUrl.mutate(
      { assetId: editingAssetId ?? undefined, sourceUrl },
      {
        onSuccess: (suggestion) => {
          setAssetForm((current) => ({ ...current, sourceUrl: suggestion.sourceUrl }));
          setImportSuggestion(suggestion);
        },
        onError: (err) => reportError(ctx.setError, err, "URL import failed"),
      },
    );
  }

  async function onExport(assetId: string) {
    ctx.setError("");
    try {
      const bom = await exportCycloneDx.mutateAsync([assetId]);
      downloadJson(bom, "cyclonedx-aibom.json");
    } catch (err) {
      reportError(ctx.setError, err, "Export failed");
    }
  }

  return (
    <AssetList
      assets={assets}
      filters={filters}
      assetForm={assetForm}
      editingAssetId={editingAssetId}
      label={label}
      onFiltersChange={setFilters}
      onFormChange={setAssetForm}
      importSuggestion={importSuggestion}
      onFetchImport={onFetchImport}
      onSubmit={onSubmit}
      onNewAsset={resetForm}
      onSelect={(id) => navigate(`/assets/${id}`)}
      onEdit={onEdit}
      onExport={onExport}
    />
  );
}

function AssetDetailRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: asset = null } = useAssetQuery(ctx.token, id);
  const { data: linkedProjects = [] } = useAssetProjectsQuery(ctx.token, id);
  const { data: modelCardData } = useAssetModelCardQuery(ctx.token, id);
  const { data: auditLogs = [] } = useAuditLogsQuery(ctx.token, "AIAsset", id);
  const { data: risks = [] } = useRisksQuery(ctx.token, {});
  const { data: projects = [] } = useProjectsQuery(ctx.token);

  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editBaseVersion, setEditBaseVersion] = useState<string | null>(null);
  const [modelCardForm, setModelCardForm] = useState<ModelCardFormState>(emptyModelCardForm);
  const [modelCardSourceUrl, setModelCardSourceUrl] = useState("");
  const [modelCardImportSuggestion, setModelCardImportSuggestion] = useState<ImportSuggestion | null>(null);
  const [selectedRiskId, setSelectedRiskId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [workflowComments, setWorkflowComments] = useState("");

  const saveAsset = useSaveAssetMutation(ctx.token);
  const transitionAsset = useTransitionAssetMutation(ctx.token, id ?? "");
  const importUrl = useImportUrlMutation(ctx.token);
  const riskLinks = useAssetRiskLinkMutations(ctx.token, id ?? "");
  const projectLinks = useAssetProjectLinkMutations(ctx.token, id ?? "");
  const saveModelCard = useSaveModelCardMutation(ctx.token, id ?? "");
  const metricMutations = useModelCardMetricMutations(ctx.token, id ?? "");

  // Reset the model-card form whenever a different asset's data lands.
  useEffect(() => {
    if (!asset) return;
    setModelCardForm(modelCardToForm(modelCardData?.modelCard ?? null));
    setModelCardSourceUrl(asset.sourceUrl ?? "");
    setModelCardImportSuggestion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, modelCardData?.modelCard]);

  function onEditAsset(target: Asset) {
    setEditingAssetId(target.id);
    setEditBaseVersion(target.updatedAt ?? null);
    setAssetForm({
      name: target.name,
      version: target.version,
      type: target.type,
      supplier: target.supplier,
      provider: target.provider ?? "",
      hostingModel: target.hostingModel,
      networkDependency: target.networkDependency,
      license: target.license ?? "",
      dataClassificationTouched: target.dataClassificationTouched ?? "",
      trainingDataProvenance: target.trainingDataProvenance ?? "",
      downstreamConsumers: target.downstreamConsumers ?? "",
      sourceUrl: target.sourceUrl ?? "",
    });
  }

  async function onSaveAsset(event: FormEvent) {
    event.preventDefault();
    ctx.setError("");
    try {
      const payload = editingAssetId && editBaseVersion ? { ...assetForm, expectedUpdatedAt: editBaseVersion } : assetForm;
      await saveAsset.mutateAsync({ id: editingAssetId ?? undefined, payload });
      setEditingAssetId(null);
      setEditBaseVersion(null);
    } catch (err) {
      reportError(ctx.setError, err, "Asset save failed");
    }
  }

  function onFetchModelCardImport(sourceUrl: string) {
    ctx.setError("");
    setModelCardSourceUrl(sourceUrl);
    setModelCardImportSuggestion(null);
    importUrl.mutate(
      { assetId: id, sourceUrl },
      {
        onSuccess: (suggestion) => {
          setModelCardSourceUrl(suggestion.sourceUrl);
          setModelCardImportSuggestion(suggestion);
        },
        onError: (err) => reportError(ctx.setError, err, "URL import failed"),
      },
    );
  }

  async function onSaveModelCard(event: FormEvent) {
    event.preventDefault();
    if (!asset) return;
    ctx.setError("");
    try {
      const payload = {
        ...modelCardForm,
        metrics: undefined,
        performanceMetrics: modelCardForm.performanceMetrics ? JSON.parse(modelCardForm.performanceMetrics) : null,
      };
      await saveModelCard.mutateAsync(payload);

      if (modelCardSourceUrl !== (asset.sourceUrl ?? "")) {
        await saveAsset.mutateAsync({
          id: asset.id,
          payload: {
            name: asset.name,
            version: asset.version,
            type: asset.type,
            supplier: asset.supplier,
            provider: asset.provider ?? "",
            hostingModel: asset.hostingModel,
            networkDependency: asset.networkDependency,
            license: asset.license ?? "",
            dataClassificationTouched: asset.dataClassificationTouched ?? "",
            trainingDataProvenance: asset.trainingDataProvenance ?? "",
            downstreamConsumers: asset.downstreamConsumers ?? "",
            sourceUrl: modelCardSourceUrl,
          },
        });
      }

      for (const metric of modelCardForm.metrics) {
        if (!metric.metricName.trim() || !metric.metricValue.trim()) continue;
        const metricValue = Number(metric.metricValue);
        if (!Number.isFinite(metricValue)) continue;
        const metricPayload = { metricName: metric.metricName.trim(), metricValue, slice: metric.slice.trim() || null };
        if (metric.id) {
          await metricMutations.update.mutateAsync({ metricId: metric.id, payload: metricPayload });
        } else {
          await metricMutations.create.mutateAsync(metricPayload);
        }
      }

      for (const metric of modelCardData?.modelCard?.metrics ?? []) {
        if (!modelCardForm.metrics.some((row) => row.id === metric.id)) {
          await metricMutations.remove.mutateAsync(metric.id);
        }
      }
    } catch (err) {
      reportError(ctx.setError, err, "Model Card save failed");
    }
  }

  async function onTransitionAsset(toStatus: string) {
    ctx.setError("");
    try {
      await transitionAsset.mutateAsync({ toStatus, comments: workflowComments || null });
      setWorkflowComments("");
    } catch (err) {
      reportError(ctx.setError, err, "Transition failed");
    }
  }

  async function onLinkRisk() {
    if (!selectedRiskId) return;
    ctx.setError("");
    try {
      await riskLinks.link.mutateAsync(selectedRiskId);
      setSelectedRiskId("");
    } catch (err) {
      reportError(ctx.setError, err, "Risk link failed");
    }
  }

  async function onUnlinkRisk(riskId: string) {
    ctx.setError("");
    try {
      await riskLinks.unlink.mutateAsync(riskId);
    } catch (err) {
      reportError(ctx.setError, err, "Risk unlink failed");
    }
  }

  async function onLinkProject() {
    if (!selectedProjectId) return;
    ctx.setError("");
    try {
      await projectLinks.link.mutateAsync(selectedProjectId);
      setSelectedProjectId("");
    } catch (err) {
      reportError(ctx.setError, err, "Project link failed");
    }
  }

  async function onUnlinkProject(projectId: string) {
    ctx.setError("");
    try {
      await projectLinks.unlink.mutateAsync(projectId);
    } catch (err) {
      reportError(ctx.setError, err, "Project unlink failed");
    }
  }

  return (
    <AssetDetail
      asset={asset}
      assetForm={assetForm}
      modelCard={modelCardData?.modelCard ?? null}
      modelCardCompleteness={modelCardData?.completeness}
      modelCardForm={modelCardForm}
      editingAssetId={editingAssetId}
      risks={risks}
      projects={projects}
      linkedProjects={linkedProjects}
      auditLogs={auditLogs}
      selectedRiskId={selectedRiskId}
      selectedProjectId={selectedProjectId}
      workflowComments={workflowComments}
      label={label}
      nextStatuses={nextStatuses}
      onBack={() => navigate("/assets")}
      onEditAsset={onEditAsset}
      onFormChange={setAssetForm}
      onSaveAsset={onSaveAsset}
      onModelCardFormChange={setModelCardForm}
      modelCardSourceUrl={modelCardSourceUrl}
      modelCardImportSuggestion={modelCardImportSuggestion}
      onModelCardSourceUrlChange={setModelCardSourceUrl}
      onFetchModelCardImport={onFetchModelCardImport}
      onSaveModelCard={onSaveModelCard}
      onSelectedRiskChange={setSelectedRiskId}
      onSelectedProjectChange={setSelectedProjectId}
      onLinkRisk={onLinkRisk}
      onUnlinkRisk={onUnlinkRisk}
      onLinkProject={onLinkProject}
      onUnlinkProject={onUnlinkProject}
      onWorkflowCommentsChange={setWorkflowComments}
      onTransitionAsset={onTransitionAsset}
    />
  );
}

function RiskRegisterRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters);
  const [riskForm, setRiskForm] = useState(emptyRisk);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [editBaseVersion, setEditBaseVersion] = useState<string | null>(null);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);

  const { data: risks = [] } = useRisksQuery(ctx.token, filters);
  const { data: assets = [] } = useAssetsQuery(ctx.token, {});
  const { data: categories = [] } = useFrameworkCategoriesQuery(ctx.token);
  const { data: atlasTechniques = [] } = useAtlasTechniquesQuery(ctx.token);
  const saveRisk = useSaveRiskMutation(ctx.token);
  const bulkUpdateRisks = useBulkUpdateRisksMutation(ctx.token);

  // sourceCategoryId is a real (framework, categoryId) foreign key — if the
  // framework changes (or reference data loads) and the current category no
  // longer belongs to it, snap to the first valid one so the select's real
  // value always matches what it's showing, not just the first <option>.
  useEffect(() => {
    const filteredCategories = categories.filter((category) => category.framework === riskForm.sourceFramework);
    const firstCategory = filteredCategories[0];
    if (firstCategory && !filteredCategories.some((category) => category.categoryId === riskForm.sourceCategoryId)) {
      setRiskForm((current) => ({ ...current, sourceCategoryId: firstCategory.categoryId }));
    }
  }, [categories, riskForm.sourceFramework, riskForm.sourceCategoryId]);

  function resetForm() {
    setRiskForm(emptyRisk);
    setEditingRiskId(null);
    setEditBaseVersion(null);
  }

  function onEditRisk(risk: Risk) {
    setEditingRiskId(risk.id);
    setEditBaseVersion(risk.updatedAt ?? null);
    setRiskForm({
      assetId: risk.assetId,
      sourceFramework: risk.sourceFramework,
      sourceCategoryId: risk.sourceCategoryId,
      euAiActRiskTier: risk.euAiActRiskTier ?? "",
      strideAiCategory: risk.strideAiCategory ?? "",
      atlasTechnique: risk.atlasTechnique ?? "",
      description: risk.description,
      likelihood: risk.likelihood,
      impact: risk.impact,
      residualRiskScore: risk.residualRiskScore ? String(risk.residualRiskScore) : "",
      treatmentPlan: risk.treatmentPlan ?? "",
      owner: risk.owner ?? "",
      dueDate: risk.dueDate ? risk.dueDate.slice(0, 10) : "",
      status: risk.status,
    });
  }

  async function onSubmitRisk(event: FormEvent) {
    event.preventDefault();
    ctx.setError("");
    try {
      const payload = {
        ...riskForm,
        likelihood: Number(riskForm.likelihood),
        impact: Number(riskForm.impact),
        residualRiskScore: riskForm.residualRiskScore ? Number(riskForm.residualRiskScore) : null,
        euAiActRiskTier: riskForm.euAiActRiskTier || null,
        strideAiCategory: riskForm.strideAiCategory || null,
        atlasTechnique: riskForm.atlasTechnique || null,
        dueDate: riskForm.dueDate ? new Date(riskForm.dueDate).toISOString() : null,
        ...(editingRiskId && editBaseVersion ? { expectedUpdatedAt: editBaseVersion } : {}),
      };
      await saveRisk.mutateAsync({ id: editingRiskId ?? undefined, payload });
      resetForm();
    } catch (err) {
      reportError(ctx.setError, err, "Risk save failed");
    }
  }

  function onOpenRisk(id: string) {
    navigate(`/risks/${id}`);
  }

  function onToggleRisk(id: string) {
    setSelectedRiskIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function onBulkUpdate(status: string) {
    ctx.setError("");
    try {
      const targeted = risks.filter((risk) => selectedRiskIds.includes(risk.id));
      await bulkUpdateRisks.mutateAsync({ risks: targeted, status });
      setSelectedRiskIds([]);
    } catch (err) {
      reportError(ctx.setError, err, "Bulk update failed");
    }
  }

  return (
    <RiskRegister
      risks={risks}
      assets={assets}
      categories={categories}
      atlasTechniques={atlasTechniques}
      filters={filters}
      riskForm={riskForm}
      editingRiskId={editingRiskId}
      selectedRiskIds={selectedRiskIds}
      label={label}
      onFiltersChange={setFilters}
      onRiskFormChange={setRiskForm}
      onSubmitRisk={onSubmitRisk}
      onNewRisk={resetForm}
      onEditRisk={onEditRisk}
      onOpenRisk={onOpenRisk}
      onToggleRisk={onToggleRisk}
      onBulkUpdate={onBulkUpdate}
    />
  );
}

function RiskDetailRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: risk = null } = useRiskQuery(ctx.token, id);
  const { data: assets = [] } = useAssetsQuery(ctx.token, {});
  const { data: projects = [] } = useProjectsQuery(ctx.token);
  const { data: controls = [] } = useControlsQuery(ctx.token);
  const { data: auditLogs = [] } = useAuditLogsQuery(ctx.token, "Risk", id);

  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedControlId, setSelectedControlId] = useState("");
  const [selectedControlStatus, setSelectedControlStatus] = useState("NOT_STARTED");

  const assetLinks = useRiskAssetLinkMutations(ctx.token, id ?? "");
  const projectLinks = useRiskProjectLinkMutations(ctx.token, id ?? "");
  const controlLinks = useRiskControlLinkMutations(ctx.token, id ?? "");

  async function onLinkAsset() {
    if (!selectedAssetId) return;
    ctx.setError("");
    try {
      await assetLinks.link.mutateAsync(selectedAssetId);
      setSelectedAssetId("");
    } catch (err) {
      reportError(ctx.setError, err, "Asset link failed");
    }
  }

  async function onUnlinkAsset(assetId: string) {
    ctx.setError("");
    try {
      await assetLinks.unlink.mutateAsync(assetId);
    } catch (err) {
      reportError(ctx.setError, err, "Asset unlink failed");
    }
  }

  async function onLinkProject() {
    if (!selectedProjectId) return;
    ctx.setError("");
    try {
      await projectLinks.link.mutateAsync(selectedProjectId);
      setSelectedProjectId("");
    } catch (err) {
      reportError(ctx.setError, err, "Project link failed");
    }
  }

  async function onUnlinkProject(projectId: string) {
    ctx.setError("");
    try {
      await projectLinks.unlink.mutateAsync(projectId);
    } catch (err) {
      reportError(ctx.setError, err, "Project unlink failed");
    }
  }

  async function onLinkControl() {
    if (!selectedControlId) return;
    ctx.setError("");
    try {
      await controlLinks.link.mutateAsync({ controlId: selectedControlId, implementationStatus: selectedControlStatus });
      setSelectedControlId("");
      setSelectedControlStatus("NOT_STARTED");
    } catch (err) {
      reportError(ctx.setError, err, "Control link failed");
    }
  }

  async function onUpdateControl(controlId: string, implementationStatus: string) {
    ctx.setError("");
    try {
      await controlLinks.update.mutateAsync({ controlId, implementationStatus });
    } catch (err) {
      reportError(ctx.setError, err, "Control update failed");
    }
  }

  async function onUnlinkControl(controlId: string) {
    ctx.setError("");
    try {
      await controlLinks.unlink.mutateAsync(controlId);
    } catch (err) {
      reportError(ctx.setError, err, "Control unlink failed");
    }
  }

  return (
    <RiskDetail
      risk={risk}
      assets={assets}
      projects={projects}
      controls={controls}
      auditLogs={auditLogs}
      selectedAssetId={selectedAssetId}
      selectedProjectId={selectedProjectId}
      selectedControlId={selectedControlId}
      selectedControlStatus={selectedControlStatus}
      label={label}
      onBack={() => navigate("/risks")}
      onSelectedAssetChange={setSelectedAssetId}
      onSelectedProjectChange={setSelectedProjectId}
      onSelectedControlChange={setSelectedControlId}
      onSelectedControlStatusChange={setSelectedControlStatus}
      onLinkAsset={onLinkAsset}
      onUnlinkAsset={onUnlinkAsset}
      onLinkProject={onLinkProject}
      onUnlinkProject={onUnlinkProject}
      onLinkControl={onLinkControl}
      onUpdateControl={onUpdateControl}
      onUnlinkControl={onUnlinkControl}
    />
  );
}

function ProjectListRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProject);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editBaseVersion, setEditBaseVersion] = useState<string | null>(null);

  const { data: projects = [] } = useProjectsQuery(ctx.token);
  const saveProject = useSaveProjectMutation(ctx.token);

  function resetForm() {
    setProjectForm(emptyProject);
    setEditingProjectId(null);
    setEditBaseVersion(null);
  }

  function onEditProject(project: Project) {
    setEditingProjectId(project.id);
    setEditBaseVersion(project.updatedAt ?? null);
    setProjectForm({
      name: project.name,
      description: project.description ?? "",
      businessOwner: project.businessOwner ?? "",
      status: project.status,
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    ctx.setError("");
    try {
      const payload = editingProjectId && editBaseVersion ? { ...projectForm, expectedUpdatedAt: editBaseVersion } : projectForm;
      await saveProject.mutateAsync({ id: editingProjectId ?? undefined, payload });
      resetForm();
    } catch (err) {
      reportError(ctx.setError, err, "Project save failed");
    }
  }

  return (
    <ProjectList
      projects={projects}
      projectForm={projectForm}
      editingProjectId={editingProjectId}
      label={label}
      onFormChange={setProjectForm}
      onSubmit={onSubmit}
      onNewProject={resetForm}
      onOpenProject={(id) => navigate(`/projects/${id}`)}
      onEditProject={onEditProject}
    />
  );
}

function ProjectDetailRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const { id } = useParams();

  const { data: project = null } = useProjectQuery(ctx.token, id);
  const { data: assets = [] } = useAssetsQuery(ctx.token, {});
  const { data: risks = [] } = useRisksQuery(ctx.token, {});
  const { data: mergedRisks = [] } = useProjectRisksQuery(ctx.token, id);

  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedRiskId, setSelectedRiskId] = useState("");

  const assetLinks = useProjectAssetLinkMutations(ctx.token, id ?? "");
  const riskLinks = useProjectRiskLinkMutations(ctx.token, id ?? "");
  const exportCycloneDx = useExportProjectCycloneDxMutation(ctx.token);

  async function onLinkAsset() {
    if (!selectedAssetId) return;
    ctx.setError("");
    try {
      await assetLinks.link.mutateAsync(selectedAssetId);
      setSelectedAssetId("");
    } catch (err) {
      reportError(ctx.setError, err, "Project asset link failed");
    }
  }

  async function onUnlinkAsset(assetId: string) {
    ctx.setError("");
    try {
      await assetLinks.unlink.mutateAsync(assetId);
    } catch (err) {
      reportError(ctx.setError, err, "Project asset unlink failed");
    }
  }

  async function onLinkRisk() {
    if (!selectedRiskId) return;
    ctx.setError("");
    try {
      await riskLinks.link.mutateAsync(selectedRiskId);
      setSelectedRiskId("");
    } catch (err) {
      reportError(ctx.setError, err, "Project risk link failed");
    }
  }

  async function onUnlinkRisk(riskId: string) {
    ctx.setError("");
    try {
      await riskLinks.unlink.mutateAsync(riskId);
    } catch (err) {
      reportError(ctx.setError, err, "Project risk unlink failed");
    }
  }

  async function onExportCycloneDx() {
    if (!id) return;
    ctx.setError("");
    try {
      const bom = await exportCycloneDx.mutateAsync(id);
      downloadJson(bom, `cyclonedx-project-${id}.json`);
    } catch (err) {
      reportError(ctx.setError, err, "Project export failed");
    }
  }

  return (
    <ProjectDetail
      project={project}
      assets={assets}
      risks={risks}
      mergedRisks={mergedRisks}
      selectedAssetId={selectedAssetId}
      selectedRiskId={selectedRiskId}
      label={label}
      onBack={() => navigate("/projects")}
      onSelectedAssetChange={setSelectedAssetId}
      onSelectedRiskChange={setSelectedRiskId}
      onLinkAsset={onLinkAsset}
      onUnlinkAsset={onUnlinkAsset}
      onLinkRisk={onLinkRisk}
      onUnlinkRisk={onUnlinkRisk}
      onExportCycloneDx={onExportCycloneDx}
    />
  );
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function NotFoundRoute() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-slate-500">There's nothing here.</p>
    </section>
  );
}

function RouteError() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-slate-500">{message}</p>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/assets" replace /> },
      { path: "dashboard", element: <DashboardRoute /> },
      { path: "assets", element: <AssetListRoute /> },
      { path: "assets/:id", element: <AssetDetailRoute /> },
      { path: "risks", element: <RiskRegisterRoute /> },
      { path: "risks/:id", element: <RiskDetailRoute /> },
      { path: "projects", element: <ProjectListRoute /> },
      { path: "projects/:id", element: <ProjectDetailRoute /> },
      { path: "users", element: <UsersRoute /> },
      { path: "*", element: <NotFoundRoute /> },
    ],
  },
]);
