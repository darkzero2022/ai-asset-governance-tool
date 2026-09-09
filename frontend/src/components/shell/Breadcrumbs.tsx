import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "ai-systems": "AI Systems",
  risks: "Risk Register",
  projects: "Projects",
  users: "Users",
  account: "Account",
  "change-password": "Change password",
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;

  const [root, detailId] = segments;
  const crumbs: Array<{ label: string; to?: string }> = [
    { label: SEGMENT_LABELS[root] ?? root, to: detailId ? `/${root}` : undefined },
  ];
  if (detailId) crumbs.push({ label: "Details" });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-subtle">
      {crumbs.map((crumb, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-text hover:underline">
              {crumb.label}
            </Link>
          ) : (
            <span aria-current="page" className="text-text">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
