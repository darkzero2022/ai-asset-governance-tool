import { lazy, useEffect } from "react";
import { createBrowserRouter, Navigate, useNavigate, useOutletContext, useParams, useRouteError } from "react-router-dom";
import App, { type AppOutletContext } from "./App";

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
 * Each route element below is a thin adapter: it reads whatever the root
 * layout (App) put on the outlet context plus its own URL params, and hands
 * them to the existing page component unchanged. The page components and all
 * the data/mutation logic in App stay exactly as they were pre-router — this
 * only replaces how a URL maps to "which page, with which params" (D1).
 * Fetching real per-route loaders is D2's job (TanStack Query). App wraps the
 * <Outlet /> in a <Suspense> boundary, so the lazy imports above just work.
 */

function useCtx() {
  return useOutletContext<AppOutletContext>();
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
  return (
    <AssetList
      assets={ctx.assets}
      filters={ctx.filters}
      assetForm={ctx.assetForm}
      editingAssetId={ctx.editingAssetId}
      label={ctx.label}
      onFiltersChange={ctx.setFilters}
      onFormChange={ctx.setAssetForm}
      importSuggestion={ctx.assetImportSuggestion}
      onFetchImport={ctx.fetchAssetImport}
      onSubmit={ctx.saveAsset}
      onNewAsset={ctx.onNewAsset}
      onSelect={ctx.openAsset}
      onEdit={ctx.editAsset}
      onExport={ctx.exportBom}
    />
  );
}

function AssetDetailRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (ctx.token && id) ctx.loadAsset(id).catch((err: Error) => ctx.setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.token, id]);

  return (
    <AssetDetail
      asset={ctx.selectedAsset}
      assetForm={ctx.assetForm}
      modelCard={ctx.assetModelCard}
      modelCardCompleteness={ctx.assetModelCardCompleteness}
      modelCardForm={ctx.modelCardForm}
      editingAssetId={ctx.editingAssetId}
      risks={ctx.risks}
      projects={ctx.projects}
      linkedProjects={ctx.assetProjects}
      auditLogs={ctx.assetAuditLogs}
      selectedRiskId={ctx.selectedAssetRiskId}
      selectedProjectId={ctx.selectedAssetProjectId}
      workflowComments={ctx.workflowComments}
      label={ctx.label}
      nextStatuses={ctx.nextStatuses}
      onBack={() => navigate("/assets")}
      onEditAsset={ctx.editAsset}
      onFormChange={ctx.setAssetForm}
      onSaveAsset={ctx.saveAsset}
      onModelCardFormChange={ctx.setModelCardForm}
      modelCardSourceUrl={ctx.modelCardSourceUrl}
      modelCardImportSuggestion={ctx.modelCardImportSuggestion}
      onModelCardSourceUrlChange={ctx.setModelCardSourceUrl}
      onFetchModelCardImport={ctx.fetchModelCardImport}
      onSaveModelCard={ctx.saveModelCard}
      onSelectedRiskChange={ctx.setSelectedAssetRiskId}
      onSelectedProjectChange={ctx.setSelectedAssetProjectId}
      onLinkRisk={ctx.linkRiskToSelectedAsset}
      onUnlinkRisk={ctx.unlinkRiskFromSelectedAsset}
      onLinkProject={ctx.linkProjectToSelectedAsset}
      onUnlinkProject={ctx.unlinkProjectFromSelectedAsset}
      onWorkflowCommentsChange={ctx.setWorkflowComments}
      onTransitionAsset={ctx.transitionAsset}
    />
  );
}

function RiskRegisterRoute() {
  const ctx = useCtx();
  return (
    <RiskRegister
      risks={ctx.risks}
      assets={ctx.assets}
      categories={ctx.categories}
      atlasTechniques={ctx.atlasTechniques}
      filters={ctx.filters}
      riskForm={ctx.riskForm}
      editingRiskId={ctx.editingRiskId}
      selectedRiskIds={ctx.selectedRiskIds}
      label={ctx.label}
      onFiltersChange={ctx.setFilters}
      onRiskFormChange={ctx.setRiskForm}
      onSubmitRisk={ctx.saveRisk}
      onNewRisk={ctx.onNewRisk}
      onEditRisk={ctx.editRisk}
      onOpenRisk={ctx.openRisk}
      onToggleRisk={ctx.onToggleRisk}
      onBulkUpdate={ctx.bulkUpdateRisks}
    />
  );
}

function RiskDetailRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (ctx.token && id) ctx.loadRisk(id).catch((err: Error) => ctx.setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.token, id]);

  return (
    <RiskDetail
      risk={ctx.selectedRisk}
      assets={ctx.assets}
      projects={ctx.projects}
      controls={ctx.controls}
      auditLogs={ctx.riskAuditLogs}
      selectedAssetId={ctx.selectedRiskAssetId}
      selectedProjectId={ctx.selectedRiskProjectId}
      selectedControlId={ctx.selectedRiskControlId}
      selectedControlStatus={ctx.selectedRiskControlStatus}
      label={ctx.label}
      onBack={() => navigate("/risks")}
      onSelectedAssetChange={ctx.setSelectedRiskAssetId}
      onSelectedProjectChange={ctx.setSelectedRiskProjectId}
      onSelectedControlChange={ctx.setSelectedRiskControlId}
      onSelectedControlStatusChange={ctx.setSelectedRiskControlStatus}
      onLinkAsset={ctx.linkAssetToSelectedRisk}
      onUnlinkAsset={ctx.unlinkAssetFromSelectedRisk}
      onLinkProject={ctx.linkProjectToSelectedRisk}
      onUnlinkProject={ctx.unlinkProjectFromSelectedRisk}
      onLinkControl={ctx.linkControlToSelectedRisk}
      onUpdateControl={ctx.updateSelectedRiskControl}
      onUnlinkControl={ctx.unlinkControlFromSelectedRisk}
    />
  );
}

function ProjectListRoute() {
  const ctx = useCtx();
  return (
    <ProjectList
      projects={ctx.projects}
      projectForm={ctx.projectForm}
      editingProjectId={ctx.editingProjectId}
      label={ctx.label}
      onFormChange={ctx.setProjectForm}
      onSubmit={ctx.saveProject}
      onNewProject={ctx.onNewProject}
      onOpenProject={ctx.openProject}
      onEditProject={ctx.editProject}
    />
  );
}

function ProjectDetailRoute() {
  const ctx = useCtx();
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (ctx.token && id) ctx.loadProject(id).catch((err: Error) => ctx.setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.token, id]);

  return (
    <ProjectDetail
      project={ctx.selectedProject}
      assets={ctx.assets}
      risks={ctx.risks}
      mergedRisks={ctx.projectRisks}
      selectedAssetId={ctx.selectedProjectAssetId}
      selectedRiskId={ctx.selectedProjectRiskId}
      label={ctx.label}
      onBack={() => navigate("/projects")}
      onSelectedAssetChange={ctx.setSelectedProjectAssetId}
      onSelectedRiskChange={ctx.setSelectedProjectRiskId}
      onLinkAsset={ctx.linkAssetToSelectedProject}
      onUnlinkAsset={ctx.unlinkAssetFromSelectedProject}
      onLinkRisk={ctx.linkRiskToSelectedProject}
      onUnlinkRisk={ctx.unlinkRiskFromSelectedProject}
      onExportCycloneDx={ctx.exportProjectBom}
    />
  );
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
