import {
  BookOpen,
  LayoutDashboard,
  UserCircle,
  type AppIcon,
} from "@/shared/icons";

export type WorkspaceNavItem = {
  label: string;
  path: string;
  icon: AppIcon;
  description?: string;
};

export const examineeNav: WorkspaceNavItem[] = [
  {
    label: "My exams",
    path: "/examinee",
    icon: LayoutDashboard,
    description: "Available and completed",
  },
  {
    label: "Profile",
    path: "/profile",
    icon: UserCircle,
    description: "Photo and password",
  },
];

export const examineeTips = [
  {
    label: "Keep your face visible",
    icon: BookOpen,
  },
];
