import { describe, expect, it } from "vitest";

import { countChanges, diffRoleAccess, toggleRoleAccess } from "@/features/admin/lib/role-permissions";

const registry = {
  actions: [
    { key: "exams.update", label: "Edit own exams", modules: ["exams"] },
    { key: "exams.update-any", label: "Edit any exam", modules: ["exams"] },
    { key: "exams.approve", label: "Review and approve exams", modules: ["exams", "exam-approvals"] },
    { key: "sessions.pause", label: "Pause and resume sessions", modules: ["monitoring"] },
  ],
};

const proctor = {
  modules: { exams: false, "exam-approvals": false, monitoring: true },
  actions: {
    "exams.update": false,
    "exams.update-any": false,
    "exams.approve": false,
    "sessions.pause": true,
  },
};

describe("toggleRoleAccess", () => {
  it("turns on the modules an action needs", () => {
    const next = toggleRoleAccess(proctor, registry, "action", "exams.approve", true);
    expect(next.actions["exams.approve"]).toBe(true);
    expect(next.modules.exams).toBe(true);
    expect(next.modules["exam-approvals"]).toBe(true);
    expect(proctor.modules.exams).toBe(false); // input untouched
  });

  it("turning an action off leaves its modules alone", () => {
    const on = toggleRoleAccess(proctor, registry, "action", "exams.update-any", true);
    const off = toggleRoleAccess(on, registry, "action", "exams.update-any", false);
    expect(off.actions["exams.update-any"]).toBe(false);
    expect(off.modules.exams).toBe(true);
  });

  it("turning a module off turns off the actions that need it", () => {
    const on = toggleRoleAccess(proctor, registry, "action", "exams.update-any", true);
    const off = toggleRoleAccess(on, registry, "module", "exams", false);
    expect(off.modules.exams).toBe(false);
    expect(off.actions["exams.update-any"]).toBe(false);
    expect(off.actions["sessions.pause"]).toBe(true);
  });
});

describe("diffRoleAccess", () => {
  it("returns only what changed", () => {
    const draft = toggleRoleAccess(proctor, registry, "action", "exams.update-any", true);
    const diff = diffRoleAccess(proctor, draft);
    expect(diff).toEqual({ modules: { exams: true }, actions: { "exams.update-any": true } });
    expect(countChanges(diff)).toBe(2);
    expect(countChanges(diffRoleAccess(proctor, proctor))).toBe(0);
  });
});
