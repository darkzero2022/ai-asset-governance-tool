import { Boxes, FolderKanban, LayoutDashboard, ShieldAlert, Users as UsersIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Grouped per the plan's Wazuh-style sidebar; only groups with a real route
// today are included (Controls/Governance/Audit Log don't have their own
// pages yet — they're reachable from within Risk/Asset detail).
export const navGroups: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", path: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Inventory",
    items: [
      { label: "AI Systems", path: "/ai-systems", icon: Boxes },
      { label: "Projects", path: "/projects", icon: FolderKanban },
    ],
  },
  { label: "Risk", items: [{ label: "Risk Register", path: "/risks", icon: ShieldAlert }] },
  { label: "Administration", items: [{ label: "Users", path: "/users", icon: UsersIcon, adminOnly: true }] },
];
