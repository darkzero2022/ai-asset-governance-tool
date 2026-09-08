import { FormEvent } from "react";
import { ProjectTable } from "../components/ProjectTable";
import { PageHeader } from "../components/shell/PageHeader";
import { Dialog, DialogFooter, DialogHeader, RadixDialog } from "../components/ui/Dialog";
import { Button } from "../components/ui/Button";
import { Input, Select, TextArea } from "../components/ui/Field";

type Project = {
  id: string;
  name: string;
  description?: string | null;
  businessOwner?: string | null;
  status: string;
  _count?: { assetLinks?: number; riskLinks?: number };
};

type ProjectForm = {
  name: string;
  description: string;
  businessOwner: string;
  status: string;
};

type Props = {
  projects: Project[];
  projectForm: ProjectForm;
  editingProjectId: string | null;
  dialogOpen: boolean;
  label: (value: string) => string;
  onFormChange: (form: ProjectForm) => void;
  onSubmit: (event: FormEvent) => void;
  onNewProject: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onOpenProject: (id: string) => void;
  onEditProject: (project: Project) => void;
  canManage: boolean;
  isLoading?: boolean;
};

export default function ProjectList(props: Props) {
  const updateForm = (key: keyof ProjectForm, value: string) => props.onFormChange({ ...props.projectForm, [key]: value });

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <PageHeader
        title="Projects"
        description="Business AI use cases and their linked AI systems and risks."
        action={props.canManage && <Button variant="primary" onClick={props.onNewProject}>New project</Button>}
      />

      <ProjectTable projects={props.projects} label={props.label} onOpen={props.onOpenProject} onEdit={props.canManage ? props.onEditProject : undefined} />

      {props.canManage && (
        <Dialog open={props.dialogOpen} onOpenChange={props.onDialogOpenChange}>
          <DialogHeader title={props.editingProjectId ? "Edit project" : "New project"} />
          <form onSubmit={props.onSubmit}>
            <div className="space-y-4">
              <Input label="Name" value={props.projectForm.name} onChange={(event) => updateForm("name", event.target.value)} />
              <Input label="Business Owner" value={props.projectForm.businessOwner} onChange={(event) => updateForm("businessOwner", event.target.value)} />
              <Select label="Status" value={props.projectForm.status} onChange={(event) => updateForm("status", event.target.value)}>
                {["ACTIVE", "INACTIVE", "RETIRED"].map((status) => <option key={status} value={status}>{props.label(status)}</option>)}
              </Select>
              <TextArea label="Description" value={props.projectForm.description} onChange={(event) => updateForm("description", event.target.value)} />
            </div>
            <DialogFooter>
              <RadixDialog.Close asChild>
                <Button type="button" variant="secondary" size="sm">Cancel</Button>
              </RadixDialog.Close>
              <Button type="submit" variant="primary" size="sm">{props.editingProjectId ? "Save project" : "Create project"}</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </section>
  );
}
