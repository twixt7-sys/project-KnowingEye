import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  description?: string;
};

export const examinerNav: WorkspaceNavItem[] = [
  {
    label: "Overview",
    path: "/examiner",
    icon: LayoutDashboard,
    description: "Exams and live activity",
  },
  {
    label: "Monitoring",
    path: "/monitoring",
    icon: Activity,
    description: "Live sessions and alerts",
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
    description: "Analytics and exports",
  },
  {
    label: "Users",
    path: "/users",
    icon: Users,
    description: "Accounts and roles",
  },
  {
    label: "Profile",
    path: "/profile",
    icon: UserCircle,
    description: "Account settings",
  },
];

export const examinerQuickActions = [
  {
    label: "Create exam",
    path: "/examiner",
    icon: ClipboardList,
  },
];
