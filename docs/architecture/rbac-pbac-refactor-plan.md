# RBAC + PBAC Refactor Plan — Knowing Eye

**Goal:** Replace the binary `ADMIN` / `EXAMINEE` model with a four-role RBAC layer
(`admin`, `faculty`, `student_assistant`, `student`) plus a fine-grained
permission (PBAC) layer, mirroring the proven pattern already shipped in the
**LCC OSAS System** (Laravel/Spatie).

This plan is the source of truth for the refactor. It is written so the OSAS
model maps 1:1 onto Knowing Eye's Django + React stack.

---

## 1. Reference model (what OSAS does, adapted)

OSAS enforces access in **three tiers**, and Knowing Eye will adopt the same three:

| Tier | OSAS mechanism | Knowing Eye equivalent | Answers |
|------|----------------|------------------------|---------|
| **1. Role guard** | `role:super_admin` middleware | `HasRole("admin")` DRF permission | "Is this user broadly this kind of user?" |
| **2. Module access** | `access:<module>` middleware + `config/osas.php` `modules` | `HasModuleAccess("<module>")` + `MODULES` registry | "Can this user see/enter this feature area at all?" |
| **3. Fine-grained action** | `permission:<action>` / `can:<action>` middleware | `HasPermission("<action>")` object/action permission | "Can this user perform this specific operation?" |

Two supporting concepts carry over verbatim:

- **Role default actions** — a role gets a starter set of action permissions on
  account creation, stored as **per-user grants** so an admin can revoke them
  individually (OSAS `role_default_actions` + `UserObserver`).
- **Grant / deny delegation** — an admin can grant `access.<module>` or deny
  `deny.<module>` to an individual user, overriding the role default (OSAS
  `EnsureModuleAccess`). An explicit deny always wins.

> **Terminology note:** OSAS has a singleton `super_admin` above `admin`. Knowing
> Eye is smaller; we fold that into `admin` and make `admin` the top role. The
> irreversible/destructive operations OSAS reserves for `super_admin` (force
> delete, restore, backup restore, clear logs) become **`admin` + a dedicated
> action permission** here, keeping the same safety intent without a second tier.

---

## 2. Target role model

| Role | Domain meaning in Knowing Eye | Baseline capability |
|------|-------------------------------|---------------------|
| `admin` | System owner / OSAS office | Everything, including user management, system config, destructive ops |
| `faculty` | Exam owner / instructor | Author & manage own exams, launch monitoring, review reports for own exams |
| `student_assistant` | Proctor aide | Live-monitor active sessions, flag/annotate behavior events, no exam authoring, no deletes |
| `student` | Examinee | Take assigned exams, view own results/profile only |

`student` replaces today's `EXAMINEE`. `admin` stays. `faculty` and
`student_assistant` are new and sit between them.

---

## 3. Module registry (Tier 2)

Single source of truth, mirroring `config/osas.php['modules']`. In Django this
lives in `core/security/modules.py`; the frontend consumes the same shape from
an API endpoint (`GET /api/auth/access-map/`) so the nav and route guards never
drift from the backend.

```python
# core/security/modules.py
MODULES = {
    "dashboard":     {"label": "Dashboard",        "roles": ["admin", "faculty", "student_assistant"]},
    "exams":         {"label": "Exam Management",  "roles": ["admin", "faculty"]},
    "monitoring":    {"label": "Live Monitoring",  "roles": ["admin", "faculty", "student_assistant"]},
    "behavior":      {"label": "Behavior Events",  "roles": ["admin", "faculty", "student_assistant"]},
    "reports":       {"label": "Reports",          "roles": ["admin", "faculty"]},
    "sessions":      {"label": "Exam Sessions",    "roles": ["admin", "faculty"]},
    "user-mgmt":     {"label": "User Management",   "roles": ["admin"]},
    "settings":      {"label": "System Settings",   "roles": ["admin"]},
    # student-facing
    "my-exams":      {"label": "My Exams",          "roles": ["student"], "student": True},
    "my-results":    {"label": "My Results",        "roles": ["student"], "student": True},
    "my-profile":    {"label": "My Profile",        "roles": ["student", "student_assistant", "faculty", "admin"]},
}
```

`roles` = default audience. An admin may additionally grant `access.<module>` to
a specific user or `deny.<module>` to revoke.

---

## 4. Permission registry (Tier 3)

Fine-grained action permissions, `<module>.<action>` naming (identical to OSAS
`student-records.view` style). Stored per-user; role defaults seeded on creation.

```python
# core/security/permissions_registry.py
PERMISSIONS = {
    # exams
    "exams.view", "exams.create", "exams.update", "exams.publish",
    "exams.delete",            # destructive -> admin default only
    # monitoring / behavior
    "monitoring.view", "monitoring.intervene", "behavior.flag", "behavior.resolve",
    # reports
    "reports.view", "reports.export",
    # sessions
    "sessions.view", "sessions.terminate",
    # users
    "users.view", "users.create", "users.update", "users.reset-password",
    "users.toggle-status", "users.archive",
    "users.force-delete",      # destructive -> admin only, never a role default
    # settings
    "settings.view", "settings.update",
}

ROLE_DEFAULT_ACTIONS = {
    "admin": "ALL",   # granted implicitly via superuser-style short-circuit
    "faculty": [
        "exams.view", "exams.create", "exams.update", "exams.publish",
        "monitoring.view", "behavior.flag", "behavior.resolve",
        "reports.view", "reports.export", "sessions.view",
    ],
    "student_assistant": [
        "monitoring.view", "behavior.flag", "reports.view",
    ],
    "student": [],    # student capabilities are object-scoped, not action grants
}
```

---

## 5. Data model changes (Django)

### 5.1 User.role
`features/authentication/models.py` — expand `Role`:

```python
class Role(models.TextChoices):
    ADMIN = "ADMIN", "Administrator"
    FACULTY = "FACULTY", "Faculty"
    STUDENT_ASSISTANT = "STUDENT_ASSISTANT", "Student Assistant"
    STUDENT = "STUDENT", "Student"
```

Keep helpers (`is_admin`) and add `is_faculty`, `is_student_assistant`,
`is_student`. Add `is_staff_role()` → role in {ADMIN, FACULTY, STUDENT_ASSISTANT}.

> `EXAMINEE` → `STUDENT` requires a data migration (see §8).

### 5.2 Per-user permission store
Two options — **recommended: reuse Django's built-in `auth.Permission` +
`user.user_permissions`** (M2M already exists, admin UI already exists, no new
tables). Custom action names are registered as `Permission` rows against a
lightweight `AccessGrant` proxy model. Module grant/deny (`access.<m>` /
`deny.<m>`) are also stored as `Permission` rows, so one mechanism covers both.

Add one small model for auditability of delegated changes (optional but
recommended, matches OSAS activity log intent):

```python
class PermissionChange(models.Model):
    target = FK(User); actor = FK(User)
    permission = CharField; action = CharField(choices=["grant","deny","revoke"])
    created_at = DateTimeField(auto_now_add=True)
```

---

## 6. Enforcement layer (Django / DRF)

New package `core/security/` (currently empty):

```
core/security/
  modules.py                # MODULES registry
  permissions_registry.py   # PERMISSIONS, ROLE_DEFAULT_ACTIONS
  drf.py                    # DRF permission classes (Tier 1/2/3)
  service.py                # can(user, perm), has_module(user, module), grant/deny/revoke
  defaults.py               # apply_role_defaults(user) — called on create
```

`drf.py` provides reusable classes replacing the scattered `is_admin()` checks:

```python
class HasRole(BasePermission):        # HasRole("admin", "faculty")
class HasModuleAccess(BasePermission): # HasModuleAccess("exams")
class HasPermission(BasePermission):   # HasPermission("exams.create")
class IsOwnerOrHasPermission(BasePermission):  # object-level, replaces IsExamOwnerOrAdmin
```

All short-circuit `admin` to allow (mirrors OSAS `super_admin` `Gate::before`).
Deny grants are checked first and always win.

### Per-view wiring (the actual refactor surface)
- `features/exams/views.py` — swap `IsAdminOrReadOnly` for
  `HasPermission("exams.*")`; object writes use `IsOwnerOrHasPermission`.
- `features/exams/permissions.py` — **delete** the bespoke classes, re-export
  from `core/security/drf` for back-compat during migration.
- `features/reports/views.py` — replace inline `if user.is_admin()` branches
  with `HasPermission("reports.view"/"reports.export")`.
- `features/monitoring/views.py` + `consumers.py` — gate WS connect and REST
  with `HasModuleAccess("monitoring")` / `HasPermission("monitoring.*")`.
- `features/behavior/views.py` — `behavior.flag` / `behavior.resolve`.
- `features/session/views.py` + `serializers.py` — replace the
  `getattr(request.user, "is_admin", ...)` calls with `service.can(...)`.
- `features/authentication/views.py` — `set_role`, list, toggle-status now gated
  by `HasPermission("users.*")` instead of `is_admin()`.

---

## 7. New API surface (User Management + delegation)

Mirrors OSAS `UserManagementController` + `UserPermissionController`:

```
GET    /api/auth/access-map/                 # this user's roles+modules+perms (drives FE)
GET    /api/auth/users/                       # users.view
POST   /api/auth/users/                       # users.create (applies role defaults)
PATCH  /api/auth/users/{id}/                  # users.update
POST   /api/auth/users/{id}/set-role/         # users.update  (re-applies defaults additively)
POST   /api/auth/users/{id}/toggle-status/    # users.toggle-status
GET    /api/auth/users/{id}/permissions/      # admin — current grants/denies
PUT    /api/auth/users/{id}/permissions/      # admin — grant/deny/revoke module+action
DELETE /api/auth/users/{id}/                  # users.force-delete (admin only)
```

`access-map` payload shape (consumed by frontend):
```json
{ "role": "faculty",
  "modules": ["dashboard","exams","monitoring","behavior","reports","sessions","my-profile"],
  "permissions": ["exams.view","exams.create", "..."] }
```

---

## 8. Data migration

1. **Schema migration** — widen `Role` choices (`0004_expand_roles`).
2. **Data migration** — `EXAMINEE` → `STUDENT` for every existing user
   (`RunPython`, reversible).
3. **Backfill migration** — for every existing non-admin user, apply
   `ROLE_DEFAULT_ACTIONS` for their role via `apply_role_defaults` (idempotent,
   additive — matches OSAS `RolesAndPermissionsSeeder`).
4. Seed/register the `access.<module>`, `deny.<module>`, and action `Permission`
   rows in a post_migrate signal so they exist before grants are made.

---

## 9. Frontend refactor (React / TS)

The frontend currently hardcodes `role === "ADMIN"` in ~4 places. Replace with a
capability-driven model fed by `/api/auth/access-map/`.

### 9.1 Auth provider (`core/providers/auth-provider.tsx`)
Replace the two booleans `is_admin` / `is_examinee` with:
```ts
interface AuthCaps {
  role: "ADMIN"|"FACULTY"|"STUDENT_ASSISTANT"|"STUDENT";
  modules: Set<string>;
  permissions: Set<string>;
  can(perm: string): boolean;          // admin -> always true
  hasModule(m: string): boolean;
  isStaff: boolean;                    // non-student
}
```
Keep `isAdmin` as a thin `role === "ADMIN"` for the few genuinely admin-only spots.

### 9.2 Route guard (`shared/components/common/protected-route.tsx`)
Extend `ProtectedRoute` to accept `requiredModule` / `requiredPermission`
alongside the existing `requiredRole`. Router (`core/router/index.tsx`) switches
admin-only routes to module/permission guards; add faculty & SA routes.

### 9.3 Navigation
`core/config/examiner-nav.ts` / `examinee-nav.ts` → build nav from the returned
`modules` set instead of a static admin/examinee split. Add a "staff" nav that
filters items by `hasModule(...)`. `layout-mode.ts` `isExaminee` → `isStudent`.

### 9.4 Feature pages
The already-modified pages in the working tree (`admin/users-page`,
`admin/settings-page`, `profile-page`, `reports/exam-summary-page`, marketing
pages) get per-control gating: wrap action buttons in `caps.can("exams.delete")`
etc. Add a **Manage Access** screen under User Management (grant/deny module +
action toggles per user), mirroring OSAS's permission-manager UI.

---

## 10. Tests

- `core/security/tests/` — unit tests for `service.can`, deny-wins, admin
  short-circuit, `apply_role_defaults`.
- Per-feature API tests: extend existing `test_auth_api.py`,
  `test_reports_api.py` with a 4-role matrix (each role × each endpoint →
  expected 200/403).
- Migration test: `EXAMINEE` rows become `STUDENT` and receive no stray grants.
- Frontend: `protected-route` guard tests for module/permission cases; nav
  renders per role.

---

## 11. Rollout order (safe, incremental)

1. **Backend foundation** — `core/security/` package + registries + service +
   DRF classes (no wiring yet). Fully unit-tested. *No behavior change.*
2. **Model + migrations** — expand roles, `EXAMINEE`→`STUDENT`, backfill grants,
   seed permission rows.
3. **Wire enforcement** — swap view permission classes feature-by-feature
   (exams → reports → monitoring/behavior → session → auth). Old `is_admin()`
   paths keep working because `admin` short-circuits.
4. **User-management + delegation API** — `access-map`, permissions endpoints.
5. **Frontend** — auth-provider caps, route/nav guards, Manage Access UI, per-
   control gating.
6. **Remove shims** — delete `features/exams/permissions.py` re-exports and any
   remaining `is_examinee`/`is_admin` ad-hoc checks.

Each step is independently shippable; the system stays functional throughout
because `admin` behaves exactly as it does today until step 5 tightens the UI.

---

## 12. File-change checklist

**Backend (new):** `core/security/{modules,permissions_registry,drf,service,defaults}.py`,
`core/security/tests/`, 3–4 migrations, `PermissionChange` model.
**Backend (edit):** `features/authentication/{models,serializers,views,urls}.py`,
`features/exams/{views,permissions}.py`, `features/reports/views.py`,
`features/monitoring/{views,consumers}.py`, `features/behavior/views.py`,
`features/session/{views,serializers}.py`.
**Frontend (edit):** `core/providers/auth-provider.tsx`,
`core/config/{api,examiner-nav,examinee-nav,layout-mode}.ts`,
`core/router/index.tsx`, `shared/components/common/protected-route.tsx`,
the already-touched feature pages + new Manage Access screen.
