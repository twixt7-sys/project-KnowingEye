import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "@/features/admin/api/admin-api";
import { RolePermissionsPanel } from "@/features/admin/components/role-permissions-panel";
import type { RolePermissionsMatrix } from "@/shared/types/api";

vi.mock("@/shared/components/common/confirm-dialog", () => ({
  useConfirm: () => async () => true,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/admin/api/admin-api", () => ({
  fetchRolePermissions: vi.fn(),
  updateRolePermissions: vi.fn(async () => undefined),
  fetchUserPermissions: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchUsers: vi.fn(),
  fetchUserStats: vi.fn(),
}));

const modules = { exams: false, monitoring: true };
const matrix: RolePermissionsMatrix = {
  modules: [
    { key: "exams", label: "Exam Management" },
    { key: "monitoring", label: "Live Monitoring" },
  ],
  actions: [
    { key: "exams.update-any", label: "Edit any exam", modules: ["exams"] },
    { key: "sessions.pause", label: "Pause and resume sessions", modules: ["monitoring"] },
  ],
  roles: [
    {
      role: "PROCTOR",
      label: "Proctor",
      modules,
      actions: { "exams.update-any": false, "sessions.pause": true },
      defaults: { modules, actions: { "exams.update-any": false, "sessions.pause": true } },
    },
    {
      role: "FACULTY",
      label: "Teacher / Exam Creator",
      modules: { exams: true, monitoring: true },
      actions: { "exams.update-any": false, "sessions.pause": true },
      defaults: {
        modules: { exams: true, monitoring: true },
        actions: { "exams.update-any": false, "sessions.pause": true },
      },
    },
  ],
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RolePermissionsPanel />
    </QueryClientProvider>,
  );
}

// Anchored: an action's label also mentions the modules it needs.
const switchFor = (label: string) =>
  screen.getByLabelText(new RegExp(`^${label}`)) as HTMLButtonElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchRolePermissions).mockResolvedValue(matrix);
});

afterEach(cleanup);

describe("RolePermissionsPanel", () => {
  it("shows the first role's current configuration", async () => {
    renderPanel();
    await screen.findByText("Edit any exam");
    expect(switchFor("Edit any exam").getAttribute("aria-checked")).toBe("false");
    expect(switchFor("Pause and resume sessions").getAttribute("aria-checked")).toBe("true");
    expect(switchFor("Exam Management").getAttribute("aria-checked")).toBe("false");
  });

  it("granting an action turns its module on and saves only the changes for that role", async () => {
    renderPanel();
    await screen.findByText("Edit any exam");

    fireEvent.click(switchFor("Edit any exam"));
    expect(switchFor("Exam Management").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("2 unsaved changes")).toBeTruthy();

    fireEvent.click(screen.getByText("Save Proctor"));
    await waitFor(() =>
      expect(api.updateRolePermissions).toHaveBeenCalledWith("PROCTOR", {
        modules: { exams: true },
        actions: { "exams.update-any": true },
      }),
    );
    // Refetches so the panel shows what the server stored.
    await waitFor(() => expect(api.fetchRolePermissions).toHaveBeenCalledTimes(2));
  });

  it("switches roles and can reset one to its defaults", async () => {
    renderPanel();
    await screen.findByText("Edit any exam");
    fireEvent.click(screen.getByRole("tab", { name: "Teacher / Exam Creator" }));
    expect(switchFor("Exam Management").getAttribute("aria-checked")).toBe("true");

    fireEvent.click(screen.getByText("Reset to defaults"));
    await waitFor(() =>
      expect(api.updateRolePermissions).toHaveBeenCalledWith("FACULTY", { reset: true }),
    );
  });

  it("disables Save until something changes", async () => {
    renderPanel();
    await screen.findByText("Edit any exam");
    expect((screen.getByText("Save Proctor").closest("button") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
