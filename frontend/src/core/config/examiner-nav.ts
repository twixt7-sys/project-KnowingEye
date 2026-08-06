import {
  Activity,
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";

export type WorkspaceNavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  description?: string;
  /** Module key this item requires (see backend core/security/modules.py); omit to always show. */
  module?: string;
};

export const examinerNav: WorkspaceNavItem[] = [
  {
    label: "Overview",
    path: "/examiner",
    icon: LayoutDashboard,
    description: "Exams and live activity",
    module: "dashboard",
  },
  {
    label: "Monitoring",
    path: "/monitoring",
    icon: Activity,
    description: "Live sessions and alerts",
    module: "monitoring",
  },
  {
    label: "Reports",
    path: "/reports",
    icon: BarChart3,
    description: "Analytics and exports",
    module: "reports",
  },
  {
    label: "Users",
    path: "/users",
    icon: Users,
    description: "Accounts and roles",
    module: "user-mgmt",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
    description: "Departments and exam codes",
    module: "settings",
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
