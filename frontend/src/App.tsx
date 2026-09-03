import { FormEvent, useEffect, useMemo, useState } from "react";
import AssetDetail from "./pages/AssetDetail";
import AssetList from "./pages/AssetList";
import Dashboard from "./pages/Dashboard";
import ProjectDetail from "./pages/ProjectDetail";
import ProjectList from "./pages/ProjectList";
import RiskDetail from "./pages/RiskDetail";
import RiskRegister from "./pages/RiskRegister";
import Users from "./pages/Users";
import { emptyModelCardForm, type ModelCard, type ModelCardCompleteness, type ModelCardFormState, modelCardToForm } from "./components/ModelCardForm";
import { navigate, useRoute } from "./router";

// Empty by default: the SPA and API share an origin (the backend serves the
// built app, and `vite dev` proxies the API paths). Set VITE_API_BASE_URL only
// when the API lives on a different origin.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

type Asset = {
  id: string;
  name: string;
  version: string;
  type: string;
  supplier: string;
  provider?: string | null;
  hostingModel: string;
  networkDependency: string;
  license?: string | null;
  dataClassificationTouched?: string | null;
  trainingDataProvenance?: string | null;
  downstreamConsumers?: string | null;
  sourceUrl?: string | null;
  status: string;
  updatedAt: string;
  _count?: { risks: number };
};

type AssetDetail = Asset & {
  risks: Risk[];
  workflow: WorkflowEntry[];
  parentDependencies?: Array<{ childAsset: { id: string; name: string; type: string } }>;
  childDependencies?: Array<{ parentAsset: { id: string; name: string; type: string } }>;
};

type Risk = {
  id: string;
  assetId: string;
  description: string;
  sourceFramework: string;
  sourceCategoryId: string;
  euAiActRiskTier?: string | null;
  strideAiCategory?: string | null;
  atlasTechnique?: string | null;
  likelihood: number;
  impact: number;
  inherentRiskScore: number;
  residualRiskScore?: number | null;
  treatmentPlan?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  status: string;
  severity?: string | null;
  asset?: { name: string } | null;
  assets?: Array<{ assetId: string; asset: Asset }>;
  projects?: Array<{ projectId: string; project: Project }>;
  controls?: Array<Control & { implementationStatus?: string; evidenceNotes?: string | null }>;
};

type Control = {
  id: string;
  name: string;
  mappedFramework: string;
  mappedControlId: string;
  description?: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  timestamp: string;
  actor?: { name: string; email: string };
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
};

type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

type FrameworkCategory = {
  id: string;
  framework: string;
  categoryId: string;
  name: string;
  description: string;
};

type WorkflowEntry = {
  id: string;
  fromStatus: string;
  toStatus: string;
  comments?: string | null;
  timestamp: string;
  approvedBy: { name: string; email: string };
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  businessOwner?: string | null;
  _count?: { assetLinks?: number; riskLinks?: number };
  assetLinks?: Array<{ assetId: string; asset: Asset }>;
  riskLinks?: Array<{ riskId: string; risk: Risk }>;
};

type ProjectForm = {
  name: string;
  description: string;
  businessOwner: string;
  status: string;
};

const emptyProject: ProjectForm = {
  name: "",
  description: "",
  businessOwner: "",
  status: "ACTIVE",
};

const emptyAsset = {
  name: "",
  version: "1.0",
  type: "SERVICE",
  supplier: "",
  provider: "",
  hostingModel: "SAAS_API",
  networkDependency: "FULLY_CONNECTED",
  license: "",
  dataClassificationTouched: "",
  trainingDataProvenance: "",
  downstreamConsumers: "",
  sourceUrl: "",
};

type ImportSuggestion = {
  sourceUrl: string;
  suggestedTitle: string;
  suggestedDescription: string;
  excerpt: string;
};

const emptyRisk = {
  assetId: "",
  sourceFramework: "OWASP_LLM_TOP10",
  sourceCategoryId: "LLM01",
  euAiActRiskTier: "",
  strideAiCategory: "",
  atlasTechnique: "",
  description: "",
  likelihood: 3,
  impact: 3,
  residualRiskScore: "",
  treatmentPlan: "",
  owner: "",
  dueDate: "",
  status: "OPEN",
};

const emptyFilters = {
  assetStatus: "",
  assetType: "",
  hostingModel: "",
  networkDependency: "",
  riskStatus: "",
  sourceFramework: "",
};

const nextStatuses: Record<string, string[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["DEPLOYED", "UNDER_REVIEW"],
  DEPLOYED: ["RETIRED"],
  RETIRED: [],
};

const navItems = [
  { label: "Dashboard", path: "/dashboard", names: ["dashboard"] },
  { label: "Assets", path: "/assets", names: ["assets", "assetDetail"] },
  { label: "Risk Register", path: "/risks", names: ["risks", "riskDetail"] },
  { label: "Projects", path: "/projects", names: ["projects", "projectDetail"] },
  { label: "Users", path: "/users", names: ["users"], adminOnly: true },
];

function label(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("aibomToken") ?? "");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [riskAuditLogs, setRiskAuditLogs] = useState<AuditLog[]>([]);
  const [assetAuditLogs, setAssetAuditLogs] = useState<AuditLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectRisks, setProjectRisks] = useState<Risk[]>([]);
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProject);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [assetProjects, setAssetProjects] = useState<Project[]>([]);
  const [assetModelCard, setAssetModelCard] = useState<ModelCard | null>(null);
  const [assetModelCardCompleteness, setAssetModelCardCompleteness] = useState<ModelCardCompleteness | undefined>();
  const [modelCardForm, setModelCardForm] = useState<ModelCardFormState>(emptyModelCardForm);
  const [modelCardSourceUrl, setModelCardSourceUrl] = useState("");
  const [assetImportSuggestion, setAssetImportSuggestion] = useState<ImportSuggestion | null>(null);
  const [modelCardImportSuggestion, setModelCardImportSuggestion] = useState<ImportSuggestion | null>(null);
  const [categories, setCategories] = useState<FrameworkCategory[]>([]);
  const [atlasTechniques, setAtlasTechniques] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [riskForm, setRiskForm] = useState(emptyRisk);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [selectedAssetRiskId, setSelectedAssetRiskId] = useState("");
  const [selectedAssetProjectId, setSelectedAssetProjectId] = useState("");
  const [workflowComments, setWorkflowComments] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [selectedRiskAssetId, setSelectedRiskAssetId] = useState("");
  const [selectedRiskProjectId, setSelectedRiskProjectId] = useState("");
  const [selectedRiskControlId, setSelectedRiskControlId] = useState("");
  const [selectedRiskControlStatus, setSelectedRiskControlStatus] = useState("NOT_STARTED");
  const [selectedProjectAssetId, setSelectedProjectAssetId] = useState("");
  const [selectedProjectRiskId, setSelectedProjectRiskId] = useState("");
  const route = useRoute();
  const [error, setError] = useState("");

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.framework === riskForm.sourceFramework),
    [categories, riskForm.sourceFramework],
  );

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: response.statusText }));
      if (response.status === 401) {
        localStorage.removeItem("aibomToken");
        setToken("");
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error(body.error ?? (response.status === 401 ? "Please sign in again" : "You do not have permission to perform this action"));
      }
      throw new Error(body.error ?? "Request failed");
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async function loadData() {
    if (!token) return;
    const assetParams = new URLSearchParams();
    if (filters.assetStatus) assetParams.set("status", filters.assetStatus);
    if (filters.assetType) assetParams.set("type", filters.assetType);
    if (filters.hostingModel) assetParams.set("hostingModel", filters.hostingModel);
    if (filters.networkDependency) assetParams.set("networkDependency", filters.networkDependency);
    const riskParams = new URLSearchParams();
    if (filters.riskStatus) riskParams.set("status", filters.riskStatus);
    if (filters.sourceFramework) riskParams.set("sourceFramework", filters.sourceFramework);
    const [assetData, riskData, referenceData, projectData, controlData, atlasData] = await Promise.all([
      api<{ assets: Asset[] }>(`/assets${assetParams.size ? `?${assetParams}` : ""}`),
      api<{ risks: Risk[] }>(`/risks${riskParams.size ? `?${riskParams}` : ""}`),
      api<{ categories: FrameworkCategory[] }>("/reference/framework-categories"),
      api<{ projects: Project[] }>("/projects"),
      api<{ controls: Control[] }>("/controls"),
      api<{ techniques: Array<{ name: string }> }>("/reference/atlas-techniques"),
    ]);
    setAssets(assetData.assets);
    setRisks(riskData.risks);
    setCategories(referenceData.categories);
    setProjects(projectData.projects);
    setControls(controlData.controls);
    setAtlasTechniques(atlasData.techniques.map((technique) => technique.name));
  }

  async function loadAsset(id: string) {
    const [data, projectData, modelCardData, auditData] = await Promise.all([
      api<{ asset: AssetDetail }>(`/assets/${id}`),
      api<{ projects: Project[] }>(`/assets/${id}/projects`),
      api<{ modelCard: ModelCard | null; completeness: ModelCardCompleteness }>(`/assets/${id}/model-card`),
      api<{ logs: AuditLog[] }>(`/audit-logs?entityType=AIAsset&entityId=${encodeURIComponent(id)}`),
    ]);
    setSelectedAsset(data.asset);
    setAssetProjects(projectData.projects);
    setAssetModelCard(modelCardData.modelCard);
    setAssetModelCardCompleteness(modelCardData.completeness);
    setModelCardForm(modelCardToForm(modelCardData.modelCard));
    setModelCardSourceUrl(data.asset.sourceUrl ?? "");
    setModelCardImportSuggestion(null);
    setAssetAuditLogs(auditData.logs);
  }

  async function loadRisk(id: string) {
    const [riskData, auditData] = await Promise.all([
      api<{ risk: Risk }>(`/risks/${id}`),
      api<{ logs: AuditLog[] }>(`/audit-logs?entityType=Risk&entityId=${encodeURIComponent(id)}`),
    ]);
    setSelectedRisk(riskData.risk);
    setRiskAuditLogs(auditData.logs);
  }

  async function loadProject(id: string) {
    const [projectData, riskData] = await Promise.all([
      api<{ project: Project }>(`/projects/${id}`),
      api<{ risks: Risk[] }>(`/projects/${id}/risks`),
    ]);
    setSelectedProject(projectData.project);
    setProjectRisks(riskData.risks);
  }

  useEffect(() => {
    loadData().catch((err: Error) => setError(err.message));
  }, [token, filters]);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      return;
    }

    api<{ user: CurrentUser }>("/auth/me").then((data) => setCurrentUser(data.user)).catch((err: Error) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (token && route.name === "assetDetail" && route.params.id) {
      loadAsset(route.params.id).catch((err: Error) => setError(err.message));
    }
  }, [token, route.name, route.params.id]);

  useEffect(() => {
    if (token && route.name === "riskDetail" && route.params.id) {
      loadRisk(route.params.id).catch((err: Error) => setError(err.message));
    }
  }, [token, route.name, route.params.id]);

  useEffect(() => {
    if (token && route.name === "projectDetail" && route.params.id) {
      loadProject(route.params.id).catch((err: Error) => setError(err.message));
    }
  }, [token, route.name, route.params.id]);

  useEffect(() => {
    const firstCategory = filteredCategories[0];
    if (firstCategory && !filteredCategories.some((category) => category.categoryId === riskForm.sourceCategoryId)) {
      setRiskForm((current) => ({ ...current, sourceCategoryId: firstCategory.categoryId }));
    }
  }, [filteredCategories, riskForm.sourceCategoryId]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();

      if (!result.token) throw new Error(result.error ?? "Login failed");
      localStorage.setItem("aibomToken", result.token);
      setToken(result.token);
      setCurrentUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function saveAsset(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const path = editingAssetId ? `/assets/${editingAssetId}` : "/assets";
      await api(path, { method: editingAssetId ? "PUT" : "POST", body: JSON.stringify(assetForm) });
      setAssetForm(emptyAsset);
      setEditingAssetId(null);
      await loadData();
      if (editingAssetId) await loadAsset(editingAssetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asset save failed");
    }
  }

  function editAsset(asset: Asset) {
    setEditingAssetId(asset.id);
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

  async function fetchAssetImport(sourceUrl: string) {
    setError("");
    setAssetForm((current) => ({ ...current, sourceUrl }));
    setAssetImportSuggestion(null);

    try {
      const path = editingAssetId ? `/assets/${editingAssetId}/import-url` : "/assets/import-url";
      const suggestion = await api<ImportSuggestion>(path, { method: "POST", body: JSON.stringify({ sourceUrl }) });
      setAssetForm((current) => ({ ...current, sourceUrl: suggestion.sourceUrl }));
      setAssetImportSuggestion(suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "URL import failed");
    }
  }

  async function fetchModelCardImport(sourceUrl: string) {
    if (!selectedAsset) return;
    setError("");
    setModelCardSourceUrl(sourceUrl);
    setModelCardImportSuggestion(null);

    try {
      const suggestion = await api<ImportSuggestion>(`/assets/${selectedAsset.id}/import-url`, { method: "POST", body: JSON.stringify({ sourceUrl }) });
      setModelCardSourceUrl(suggestion.sourceUrl);
      setModelCardImportSuggestion(suggestion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "URL import failed");
    }
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const path = editingProjectId ? `/projects/${editingProjectId}` : "/projects";
      await api(path, { method: editingProjectId ? "PUT" : "POST", body: JSON.stringify(projectForm) });
      setProjectForm(emptyProject);
      setEditingProjectId(null);
      await loadData();
      if (editingProjectId) await loadProject(editingProjectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project save failed");
    }
  }

  function editProject(project: Project) {
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name,
      description: project.description ?? "",
      businessOwner: project.businessOwner ?? "",
      status: project.status,
    });
  }

  function openProject(id: string) {
    navigate(`/projects/${id}`);
    loadProject(id).catch((err: Error) => setError(err.message));
  }

  async function saveRisk(event: FormEvent) {
    event.preventDefault();
    setError("");

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
      };
      const path = editingRiskId ? `/risks/${editingRiskId}` : "/risks";
      await api(path, { method: editingRiskId ? "PUT" : "POST", body: JSON.stringify(payload) });
      setRiskForm(emptyRisk);
      setEditingRiskId(null);
      await loadData();
      if (selectedAsset) await loadAsset(selectedAsset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk save failed");
    }
  }

  function editRisk(risk: Risk) {
    setEditingRiskId(risk.id);
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

  function openRisk(id: string) {
    navigate(`/risks/${id}`);
    loadRisk(id).catch((err: Error) => setError(err.message));
  }

  async function bulkUpdateRisks(status: string) {
    setError("");
    try {
      await Promise.all(selectedRiskIds.map((id) => {
        const risk = risks.find((item) => item.id === id);
        if (!risk) return Promise.resolve();
        return api(`/risks/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            assetId: risk.assetId,
            sourceFramework: risk.sourceFramework,
            sourceCategoryId: risk.sourceCategoryId,
            euAiActRiskTier: risk.euAiActRiskTier ?? null,
            strideAiCategory: risk.strideAiCategory ?? null,
            atlasTechnique: risk.atlasTechnique ?? null,
            description: risk.description,
            likelihood: risk.likelihood,
            impact: risk.impact,
            residualRiskScore: risk.residualRiskScore ?? null,
            treatmentPlan: risk.treatmentPlan ?? null,
            owner: risk.owner ?? null,
            dueDate: risk.dueDate ?? null,
            status,
          }),
        });
      }));
      setSelectedRiskIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk update failed");
    }
  }

  async function transitionAsset(toStatus: string) {
    if (!selectedAsset) return;
    setError("");

    try {
      await api(`/assets/${selectedAsset.id}/transition`, {
        method: "POST",
        body: JSON.stringify({ toStatus, comments: workflowComments || null }),
      });
      setWorkflowComments("");
      await loadData();
      await loadAsset(selectedAsset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transition failed");
    }
  }

  async function linkRiskToSelectedAsset() {
    if (!selectedAsset || !selectedAssetRiskId) return;
    setError("");

    try {
      await api(`/assets/${selectedAsset.id}/risks/${selectedAssetRiskId}`, { method: "POST" });
      setSelectedAssetRiskId("");
      await loadAsset(selectedAsset.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk link failed");
    }
  }

  async function unlinkRiskFromSelectedAsset(riskId: string) {
    if (!selectedAsset) return;
    setError("");

    try {
      await api(`/assets/${selectedAsset.id}/risks/${riskId}`, { method: "DELETE" });
      await loadAsset(selectedAsset.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risk unlink failed");
    }
  }

  async function linkProjectToSelectedAsset() {
    if (!selectedAsset || !selectedAssetProjectId) return;
    setError("");

    try {
      await api(`/projects/${selectedAssetProjectId}/assets/${selectedAsset.id}`, { method: "POST" });
      setSelectedAssetProjectId("");
      await loadAsset(selectedAsset.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project link failed");
    }
  }

  async function unlinkProjectFromSelectedAsset(projectId: string) {
    if (!selectedAsset) return;
    setError("");

    try {
      await api(`/projects/${projectId}/assets/${selectedAsset.id}`, { method: "DELETE" });
      await loadAsset(selectedAsset.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project unlink failed");
    }
  }

  async function linkAssetToSelectedRisk() {
    if (!selectedRisk || !selectedRiskAssetId) return;
    setError("");

    try {
      await api(`/assets/${selectedRiskAssetId}/risks/${selectedRisk.id}`, { method: "POST" });
      setSelectedRiskAssetId("");
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asset link failed");
    }
  }

  async function unlinkAssetFromSelectedRisk(assetId: string) {
    if (!selectedRisk) return;
    setError("");

    try {
      await api(`/assets/${assetId}/risks/${selectedRisk.id}`, { method: "DELETE" });
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Asset unlink failed");
    }
  }

  async function linkProjectToSelectedRisk() {
    if (!selectedRisk || !selectedRiskProjectId) return;
    setError("");

    try {
      await api(`/projects/${selectedRiskProjectId}/risks/${selectedRisk.id}`, { method: "POST" });
      setSelectedRiskProjectId("");
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project link failed");
    }
  }

  async function unlinkProjectFromSelectedRisk(projectId: string) {
    if (!selectedRisk) return;
    setError("");

    try {
      await api(`/projects/${projectId}/risks/${selectedRisk.id}`, { method: "DELETE" });
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project unlink failed");
    }
  }

  async function linkControlToSelectedRisk() {
    if (!selectedRisk || !selectedRiskControlId) return;
    setError("");

    try {
      await api(`/risks/${selectedRisk.id}/controls/${selectedRiskControlId}`, { method: "POST", body: JSON.stringify({ implementationStatus: selectedRiskControlStatus }) });
      setSelectedRiskControlId("");
      setSelectedRiskControlStatus("NOT_STARTED");
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Control link failed");
    }
  }

  async function updateSelectedRiskControl(controlId: string, implementationStatus: string) {
    if (!selectedRisk) return;
    setError("");

    try {
      await api(`/risks/${selectedRisk.id}/controls/${controlId}`, { method: "PUT", body: JSON.stringify({ implementationStatus }) });
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Control update failed");
    }
  }

  async function unlinkControlFromSelectedRisk(controlId: string) {
    if (!selectedRisk) return;
    setError("");

    try {
      await api(`/risks/${selectedRisk.id}/controls/${controlId}`, { method: "DELETE" });
      await loadRisk(selectedRisk.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Control unlink failed");
    }
  }

  async function saveModelCard(event: FormEvent) {
    event.preventDefault();
    if (!selectedAsset) return;
    setError("");

    try {
      const payload = {
        ...modelCardForm,
        metrics: undefined,
        performanceMetrics: modelCardForm.performanceMetrics ? JSON.parse(modelCardForm.performanceMetrics) : null,
      };
      const response = await api<{ modelCard: ModelCard }>(`/assets/${selectedAsset.id}/model-card`, { method: "PUT", body: JSON.stringify(payload) });

      if (modelCardSourceUrl !== (selectedAsset.sourceUrl ?? "")) {
        const assetPayload = {
          name: selectedAsset.name,
          version: selectedAsset.version,
          type: selectedAsset.type,
          supplier: selectedAsset.supplier,
          provider: selectedAsset.provider ?? "",
          hostingModel: selectedAsset.hostingModel,
          networkDependency: selectedAsset.networkDependency,
          license: selectedAsset.license ?? "",
          dataClassificationTouched: selectedAsset.dataClassificationTouched ?? "",
          trainingDataProvenance: selectedAsset.trainingDataProvenance ?? "",
          downstreamConsumers: selectedAsset.downstreamConsumers ?? "",
          sourceUrl: modelCardSourceUrl,
        };
        await api(`/assets/${selectedAsset.id}`, { method: "PUT", body: JSON.stringify(assetPayload) });
      }

      for (const metric of modelCardForm.metrics) {
        if (!metric.metricName.trim() || !metric.metricValue.trim()) continue;
        const metricValue = Number(metric.metricValue);
        if (!Number.isFinite(metricValue)) continue;
        const metricPayload = { metricName: metric.metricName.trim(), metricValue, slice: metric.slice.trim() || null };
        if (metric.id) {
          await api(`/assets/${selectedAsset.id}/model-card/metrics/${metric.id}`, { method: "PUT", body: JSON.stringify(metricPayload) });
        } else {
          await api(`/assets/${selectedAsset.id}/model-card/metrics`, { method: "POST", body: JSON.stringify(metricPayload) });
        }
      }

      for (const metric of assetModelCard?.metrics ?? []) {
        if (!modelCardForm.metrics.some((row) => row.id === metric.id)) {
          await api(`/assets/${selectedAsset.id}/model-card/metrics/${metric.id}`, { method: "DELETE" });
        }
      }

      const refreshed = await api<{ modelCard: ModelCard | null; completeness: ModelCardCompleteness }>(`/assets/${selectedAsset.id}/model-card`);
      setAssetModelCard(refreshed.modelCard ?? response.modelCard);
      setAssetModelCardCompleteness(refreshed.completeness);
      setModelCardForm(modelCardToForm(refreshed.modelCard ?? response.modelCard));
      await loadAsset(selectedAsset.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Model Card save failed");
    }
  }

  async function linkAssetToSelectedProject() {
    if (!selectedProject || !selectedProjectAssetId) return;
    setError("");

    try {
      await api(`/projects/${selectedProject.id}/assets/${selectedProjectAssetId}`, { method: "POST" });
      setSelectedProjectAssetId("");
      await loadProject(selectedProject.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project asset link failed");
    }
  }

  async function unlinkAssetFromSelectedProject(assetId: string) {
    if (!selectedProject) return;
    setError("");

    try {
      await api(`/projects/${selectedProject.id}/assets/${assetId}`, { method: "DELETE" });
      await loadProject(selectedProject.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project asset unlink failed");
    }
  }

  async function linkRiskToSelectedProject() {
    if (!selectedProject || !selectedProjectRiskId) return;
    setError("");

    try {
      await api(`/projects/${selectedProject.id}/risks/${selectedProjectRiskId}`, { method: "POST" });
      setSelectedProjectRiskId("");
      await loadProject(selectedProject.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project risk link failed");
    }
  }

  async function unlinkRiskFromSelectedProject(riskId: string) {
    if (!selectedProject) return;
    setError("");

    try {
      await api(`/projects/${selectedProject.id}/risks/${riskId}`, { method: "DELETE" });
      await loadProject(selectedProject.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project risk unlink failed");
    }
  }

  async function exportProjectBom() {
    if (!selectedProject) return;
    setError("");

    try {
      const bom = await api<Record<string, unknown>>(`/projects/${selectedProject.id}/export/cyclonedx`);
      const blob = new Blob([JSON.stringify(bom, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cyclonedx-project-${selectedProject.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Project export failed");
    }
  }

  async function exportBom(assetId: string) {
    setError("");
    try {
      const bom = await api<Record<string, unknown>>("/exports/cyclonedx", {
        method: "POST",
        body: JSON.stringify({ assetIds: [assetId] }),
      });
      const blob = new Blob([JSON.stringify(bom, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cyclonedx-aibom.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">AI-BOM Governance</p>
          <h1 className="text-4xl font-semibold tracking-tight">Sign in to manage AI assets</h1>
          <form onSubmit={login} className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/40">
            <label className="block text-sm text-slate-300" htmlFor="email">Email</label>
            <input id="email" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
            <label className="mt-4 block text-sm text-slate-300" htmlFor="password">Password</label>
            <input id="password" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <button className="mt-6 w-full rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-200">Sign in</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">AI-BOM Governance</p>
            <h1 className="text-3xl font-semibold tracking-tight">AI Asset Inventory</h1>
          </div>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" onClick={() => { localStorage.removeItem("aibomToken"); setToken(""); }}>
            Sign out
          </button>
          <nav className="flex flex-wrap gap-3 text-sm font-semibold">
            {navItems.filter((item) => !item.adminOnly || currentUser?.role === "ADMIN").map((item) => {
              const active = item.names.includes(route.name);
              return (
                <button key={item.path} className={`rounded-lg border px-4 py-2 ${active ? "border-cyan-700 bg-cyan-50 text-cyan-800" : "border-slate-300"}`} onClick={() => navigate(item.path)}>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {error && <div className="mx-auto max-w-7xl px-6 pt-6"><p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p></div>}
      {route.name === "dashboard" ? (
        <Dashboard apiBaseUrl={apiBaseUrl} token={token} />
      ) : route.name === "users" ? (
        currentUser?.role === "ADMIN" ? <Users apiBaseUrl={apiBaseUrl} token={token} /> : <section className="mx-auto max-w-7xl px-6 py-8"><div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">Admin access required.</div></section>
      ) : route.name === "riskDetail" ? (
        <RiskDetail
          risk={selectedRisk}
          assets={assets}
          projects={projects}
          controls={controls}
          auditLogs={riskAuditLogs}
          selectedAssetId={selectedRiskAssetId}
          selectedProjectId={selectedRiskProjectId}
          selectedControlId={selectedRiskControlId}
          selectedControlStatus={selectedRiskControlStatus}
          label={label}
          onBack={() => navigate("/risks")}
          onSelectedAssetChange={setSelectedRiskAssetId}
          onSelectedProjectChange={setSelectedRiskProjectId}
          onSelectedControlChange={setSelectedRiskControlId}
          onSelectedControlStatusChange={setSelectedRiskControlStatus}
          onLinkAsset={linkAssetToSelectedRisk}
          onUnlinkAsset={unlinkAssetFromSelectedRisk}
          onLinkProject={linkProjectToSelectedRisk}
          onUnlinkProject={unlinkProjectFromSelectedRisk}
          onLinkControl={linkControlToSelectedRisk}
          onUpdateControl={updateSelectedRiskControl}
          onUnlinkControl={unlinkControlFromSelectedRisk}
        />
      ) : route.name === "risks" ? (
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
          onSubmitRisk={saveRisk}
          onNewRisk={() => { setEditingRiskId(null); setRiskForm(emptyRisk); }}
          onEditRisk={editRisk}
          onOpenRisk={openRisk}
          onToggleRisk={(id) => setSelectedRiskIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
          onBulkUpdate={bulkUpdateRisks}
        />
      ) : route.name === "projectDetail" ? (
        <ProjectDetail
          project={selectedProject}
          assets={assets}
          risks={risks}
          mergedRisks={projectRisks}
          selectedAssetId={selectedProjectAssetId}
          selectedRiskId={selectedProjectRiskId}
          label={label}
          onBack={() => navigate("/projects")}
          onSelectedAssetChange={setSelectedProjectAssetId}
          onSelectedRiskChange={setSelectedProjectRiskId}
          onLinkAsset={linkAssetToSelectedProject}
          onUnlinkAsset={unlinkAssetFromSelectedProject}
          onLinkRisk={linkRiskToSelectedProject}
          onUnlinkRisk={unlinkRiskFromSelectedProject}
          onExportCycloneDx={exportProjectBom}
        />
      ) : route.name === "projects" ? (
        <ProjectList
          projects={projects}
          projectForm={projectForm}
          editingProjectId={editingProjectId}
          label={label}
          onFormChange={setProjectForm}
          onSubmit={saveProject}
          onNewProject={() => { setEditingProjectId(null); setProjectForm(emptyProject); }}
          onOpenProject={openProject}
          onEditProject={editProject}
        />
      ) : route.name === "assetDetail" ? (
        <AssetDetail
          asset={selectedAsset}
          assetForm={assetForm}
          modelCard={assetModelCard}
          modelCardCompleteness={assetModelCardCompleteness}
          modelCardForm={modelCardForm}
          editingAssetId={editingAssetId}
          risks={risks}
          projects={projects}
          linkedProjects={assetProjects}
          auditLogs={assetAuditLogs}
          selectedRiskId={selectedAssetRiskId}
          selectedProjectId={selectedAssetProjectId}
          workflowComments={workflowComments}
          label={label}
          nextStatuses={nextStatuses}
          onBack={() => navigate("/assets")}
          onEditAsset={editAsset}
          onFormChange={setAssetForm}
          onSaveAsset={saveAsset}
          onModelCardFormChange={setModelCardForm}
          modelCardSourceUrl={modelCardSourceUrl}
          modelCardImportSuggestion={modelCardImportSuggestion}
          onModelCardSourceUrlChange={setModelCardSourceUrl}
          onFetchModelCardImport={fetchModelCardImport}
          onSaveModelCard={saveModelCard}
          onSelectedRiskChange={setSelectedAssetRiskId}
          onSelectedProjectChange={setSelectedAssetProjectId}
          onLinkRisk={linkRiskToSelectedAsset}
          onUnlinkRisk={unlinkRiskFromSelectedAsset}
          onLinkProject={linkProjectToSelectedAsset}
          onUnlinkProject={unlinkProjectFromSelectedAsset}
          onWorkflowCommentsChange={setWorkflowComments}
          onTransitionAsset={transitionAsset}
        />
      ) : (
        <AssetList
          assets={assets}
          filters={filters}
          assetForm={assetForm}
          editingAssetId={editingAssetId}
          label={label}
          onFiltersChange={setFilters}
          onFormChange={setAssetForm}
          importSuggestion={assetImportSuggestion}
          onFetchImport={fetchAssetImport}
          onSubmit={saveAsset}
          onNewAsset={() => { setEditingAssetId(null); setAssetForm(emptyAsset); }}
          onSelect={(id) => { navigate(`/assets/${id}`); loadAsset(id).catch((err: Error) => setError(err.message)); }}
          onEdit={editAsset}
          onExport={exportBom}
        />
      )}
    </main>
  );
}

function Field(props: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" type={props.type ?? "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function TextArea(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

function Select(props: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {props.label}
      <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        {props.options.map((option) => <option key={option} value={option}>{props.optionLabels?.[option] ?? label(option)}</option>)}
      </select>
    </label>
  );
}

export default App;
