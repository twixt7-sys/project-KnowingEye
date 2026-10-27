import type { RolePermissionsMatrix } from "@/shared/types/api";

export interface RoleAccessDraft {
  modules: Record<string, boolean>;
  actions: Record<string, boolean>;
}

/**
 * Apply one switch flip to a role's draft, keeping it usable the same way the
 * server does (`set_role_permissions`): turning an action on turns on the
 * modules it needs, and turning a module off turns off the actions that need it.
 */
export function toggleRoleAccess(
  draft: RoleAccessDraft,
  registry: Pick<RolePermissionsMatrix, "actions">,
  kind: "module" | "action",
  key: string,
  enabled: boolean,
): RoleAccessDraft {
  const modules = { ...draft.modules };
  const actions = { ...draft.actions };
  if (kind === "module") {
    modules[key] = enabled;
    if (!enabled) {
      for (const action of registry.actions) {
        if (action.modules.includes(key)) actions[action.key] = false;
      }
    }
  } else {
    actions[key] = enabled;
    if (enabled) {
      const needs = registry.actions.find((a) => a.key === key)?.modules ?? [];
      for (const module of needs) modules[module] = true;
    }
  }
  return { modules, actions };
}

/** Only the entries of `draft` that differ from `saved` - what a PUT needs to send. */
export function diffRoleAccess(saved: RoleAccessDraft, draft: RoleAccessDraft): RoleAccessDraft {
  const pick = (a: Record<string, boolean>, b: Record<string, boolean>) =>
    Object.fromEntries(Object.entries(b).filter(([k, v]) => a[k] !== v));
  return { modules: pick(saved.modules, draft.modules), actions: pick(saved.actions, draft.actions) };
}

export function countChanges(diff: RoleAccessDraft): number {
  return Object.keys(diff.modules).length + Object.keys(diff.actions).length;
}
