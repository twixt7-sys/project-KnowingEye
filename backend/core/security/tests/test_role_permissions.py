"""Role-level permission configuration (bug reports 2 and 3).

* every role gets its predefined module/action set automatically;
* an admin's edit to a role applies to its users on their very next request
  (same JWT, no re-login), including exam editing;
* per-user overrides layer on top of the role (user grant + role grants are
  combined; an explicit deny wins);
* a missing permission is denied;
* seeding only fills in missing rows and the 0010 data migration turns old
  per-user copies of role defaults back into inheritance without losing an
  admin's own grants/revocations.
"""

from __future__ import annotations

import importlib

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from core.security import service
from core.security.modules import MODULES
from core.security.permissions_registry import PERMISSIONS
from features.authentication.models import PermissionChange, RolePermission
from features.exams.models import Exam

User = get_user_model()

PASSWORD = "TestPass123!"

# The documented default matrix (also in the PR). Written out literally so a
# change to the registry has to be a deliberate change here too.
EXPECTED_MODULES = {
    "GUIDANCE_STAFF": {"dashboard", "exams", "monitoring", "behavior", "reports", "sessions", "my-profile"},
    "PROGRAM_HEAD": {
        "dashboard", "exams", "exam-approvals", "monitoring", "behavior", "reports", "sessions", "my-profile",
    },
    "FACULTY": {"dashboard", "exams", "monitoring", "behavior", "reports", "sessions", "my-profile"},
    "PROCTOR": {"dashboard", "monitoring", "behavior", "reports", "my-profile"},
    "STUDENT": {"my-exams", "my-results", "my-profile"},
}
EXPECTED_ACTIONS = {
    "GUIDANCE_STAFF": {
        "exams.create", "exams.update", "monitoring.intervene", "behavior.resolve", "reports.export",
        "sessions.pause", "sessions.terminate", "sessions.grade",
    },
    "PROGRAM_HEAD": {
        "exams.create", "exams.update", "exams.approve", "monitoring.intervene", "behavior.resolve",
        "reports.export", "sessions.pause", "sessions.terminate", "sessions.grade",
    },
    "FACULTY": {
        "exams.create", "exams.update", "monitoring.intervene", "behavior.resolve", "reports.export",
        "sessions.pause", "sessions.grade",
    },
    "PROCTOR": {"monitoring.intervene", "behavior.resolve", "sessions.pause", "sessions.terminate"},
    "STUDENT": set(),
}


def make_user(role, username, **extra):
    return User.objects.create_user(
        username=username,
        email=f"{username}@test.local",
        password=PASSWORD,
        role=role,
        **extra,
    )


def fresh(user):
    """Reload ``user`` the way each request does, with no per-instance caches."""
    return User.objects.get(pk=user.pk)


class RoleDefaultMatrixTests(TestCase):
    def test_each_role_gets_its_predefined_modules_and_actions(self):
        for role in EXPECTED_MODULES:
            with self.subTest(role=role):
                user = make_user(role, f"matrix_{role.lower()}")
                access = service.list_user_access(user)
                self.assertEqual(set(access["modules"]), EXPECTED_MODULES[role])
                self.assertEqual(set(access["permissions"]), EXPECTED_ACTIONS[role])

    def test_defaults_apply_without_any_per_user_grants(self):
        # Bug 3: nothing has to be copied onto the account for it to work.
        faculty = make_user(User.Role.FACULTY, "matrix_no_grants")
        self.assertEqual(faculty.user_permissions.count(), 0)
        self.assertTrue(service.can(faculty, "exams.create"))
        self.assertTrue(service.has_module(faculty, "exams"))

    def test_admin_holds_everything(self):
        admin = make_user(User.Role.ADMIN, "matrix_admin")
        access = service.list_user_access(admin)
        self.assertEqual(set(access["modules"]), set(MODULES))
        self.assertEqual(set(access["permissions"]), PERMISSIONS)

    def test_every_default_action_has_its_modules(self):
        # A default action whose module is off would be unusable.
        from core.security.permissions_registry import PERMISSION_META

        for role, actions in EXPECTED_ACTIONS.items():
            for action in actions:
                for module in PERMISSION_META[action]["modules"]:
                    self.assertIn(module, EXPECTED_MODULES[role], f"{role}: {action} needs {module}")

    def test_missing_permission_is_denied(self):
        proctor = make_user(User.Role.PROCTOR, "matrix_proctor_deny")
        student = make_user(User.Role.STUDENT, "matrix_student_deny")
        self.assertFalse(service.can(proctor, "exams.create"))
        self.assertFalse(service.can(proctor, "exams.update"))
        self.assertFalse(service.has_module(proctor, "exams"))
        self.assertFalse(service.can(student, "sessions.pause"))
        self.assertFalse(service.can(proctor, "not.a.real.action"))


class SeedingTests(TestCase):
    def test_post_migrate_seeded_every_configurable_role(self):
        for role in service.configurable_roles():
            rows = RolePermission.objects.filter(role=role).count()
            self.assertEqual(rows, len(MODULES) + len(PERMISSIONS), role)
        self.assertFalse(RolePermission.objects.filter(role=User.Role.ADMIN).exists())

    def test_seeding_fills_missing_rows_but_never_overwrites_an_edit(self):
        RolePermission.objects.filter(role="FACULTY", permission="action.exams.update").update(granted=False)
        RolePermission.objects.filter(role="FACULTY", permission="action.exams.create").delete()

        created = service.ensure_role_defaults()

        self.assertEqual(created, 1)
        self.assertFalse(
            RolePermission.objects.get(role="FACULTY", permission="action.exams.update").granted
        )
        self.assertTrue(
            RolePermission.objects.get(role="FACULTY", permission="action.exams.create").granted
        )

    def test_missing_row_falls_back_to_the_code_default(self):
        RolePermission.objects.filter(role="PROCTOR").delete()
        proctor = make_user(User.Role.PROCTOR, "seed_fallback")
        self.assertTrue(service.can(proctor, "sessions.pause"))
        self.assertTrue(service.has_module(proctor, "monitoring"))

    def test_assigning_a_role_seeds_it(self):
        RolePermission.objects.filter(role="PROGRAM_HEAD").delete()
        user = make_user(User.Role.PROGRAM_HEAD, "seed_on_assign")
        service.apply_role_defaults(user)
        self.assertTrue(RolePermission.objects.filter(role="PROGRAM_HEAD").exists())
        self.assertEqual(user.user_permissions.count(), 0)


class RoleEditTests(TestCase):
    def test_role_edit_applies_to_existing_users_of_that_role(self):
        proctor = make_user(User.Role.PROCTOR, "edit_proctor")
        faculty = make_user(User.Role.FACULTY, "edit_faculty")
        self.assertFalse(service.can(proctor, "exams.update-any"))

        service.set_role_permissions("PROCTOR", {}, {"exams.update-any": True})

        proctor = fresh(proctor)
        self.assertTrue(service.can(proctor, "exams.update-any"))
        self.assertFalse(service.can(fresh(faculty), "exams.update-any"))

    def test_enabling_an_action_turns_on_the_modules_it_needs(self):
        config = service.set_role_permissions("PROCTOR", {}, {"exams.update": True})
        self.assertTrue(config["module.exams"])
        self.assertTrue(service.has_module(make_user(User.Role.PROCTOR, "dep_proctor"), "exams"))

    def test_disabling_a_module_turns_off_the_actions_that_need_it(self):
        config = service.set_role_permissions("FACULTY", {"exams": False}, {})
        self.assertFalse(config["module.exams"])
        self.assertFalse(config["action.exams.create"])
        self.assertFalse(config["action.exams.update"])
        self.assertFalse(config["action.sessions.grade"])
        self.assertTrue(config["action.behavior.resolve"])

    def test_revoking_a_role_action_denies_it(self):
        faculty = make_user(User.Role.FACULTY, "edit_revoke")
        service.set_role_permissions("FACULTY", {}, {"exams.create": False})
        self.assertFalse(service.can(fresh(faculty), "exams.create"))
        self.assertTrue(service.can(fresh(faculty), "exams.update"))

    def test_role_change_drops_the_old_roles_permissions(self):
        user = make_user(User.Role.FACULTY, "edit_demoted")
        self.assertTrue(service.can(user, "exams.create"))
        user.role = User.Role.PROCTOR
        user.save(update_fields=["role"])
        service.apply_role_defaults(user)
        self.assertFalse(service.can(user, "exams.create"))
        self.assertFalse(service.has_module(user, "exams"))
        self.assertTrue(service.can(user, "sessions.terminate"))


class UserOverrideTests(TestCase):
    def test_user_grant_adds_to_role_permissions(self):
        proctor = make_user(User.Role.PROCTOR, "ovr_union")
        service.set_user_action(proctor, "reports.export", True)
        proctor = fresh(proctor)
        # Granted to this user, plus everything the role gives.
        self.assertTrue(service.can(proctor, "reports.export"))
        self.assertTrue(service.can(proctor, "sessions.pause"))

    def test_user_deny_beats_role_grant(self):
        faculty = make_user(User.Role.FACULTY, "ovr_deny")
        service.set_user_action(faculty, "exams.create", False)
        self.assertFalse(service.can(fresh(faculty), "exams.create"))
        # ...and still wins after the role is re-saved with it on.
        service.set_role_permissions("FACULTY", {}, {"exams.create": True})
        self.assertFalse(service.can(fresh(faculty), "exams.create"))

    def test_toggle_matching_the_role_stores_no_override(self):
        faculty = make_user(User.Role.FACULTY, "ovr_minimal")
        service.set_user_action(faculty, "exams.create", True)
        self.assertEqual(service.user_overrides(faculty), {"modules": {}, "actions": {}})
        # So the user keeps following later role edits.
        service.set_role_permissions("FACULTY", {}, {"exams.create": False})
        self.assertFalse(service.can(fresh(faculty), "exams.create"))

    def test_clearing_an_override_falls_back_to_the_role(self):
        faculty = make_user(User.Role.FACULTY, "ovr_clear")
        service.set_user_action(faculty, "exams.create", False)
        service.set_user_action(faculty, "exams.create", None)
        self.assertTrue(service.can(fresh(faculty), "exams.create"))

    def test_user_module_deny_beats_role(self):
        faculty = make_user(User.Role.FACULTY, "ovr_module")
        service.set_user_module(faculty, "reports", "deny")
        self.assertFalse(service.has_module(fresh(faculty), "reports"))
        service.set_user_module(faculty, "reports", None)
        self.assertTrue(service.has_module(fresh(faculty), "reports"))


def _token(client, username):
    response = client.post(
        "/api/auth/token/", {"username": username, "password": PASSWORD}, format="json"
    )
    assert response.status_code == 200, response.content
    return response.data["access"]


class RolePermissionApiTests(APITestCase):
    """End to end over HTTP with real JWTs, as the browser does it."""

    def setUp(self):
        self.admin = make_user(User.Role.ADMIN, "api_admin", email_verified=True)
        self.owner = make_user(User.Role.FACULTY, "api_owner", email_verified=True)
        self.exam = Exam.objects.create(
            title="Someone else's exam",
            description="x",
            duration_minutes=30,
            passing_score=60,
            status=Exam.Status.DRAFT,
            created_by=self.owner,
        )

    def _as(self, token):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    def _admin_put(self, role, body):
        self.client.force_authenticate(user=None)
        self._as(_token(self.client, "api_admin"))
        return self.client.put(f"/api/auth/roles/{role}/permissions/", body, format="json")

    def _edit_exam(self, token, title="Edited"):
        self._as(token)
        return self.client.patch(f"/api/exams/{self.exam.id}/", {"title": title}, format="json")

    def test_admin_grant_lets_each_staff_role_edit_an_exam_on_the_same_token(self):
        # Bug 2's repro: Proctor, Teacher (faculty/examiner) and Program Head
        # users can't edit the exam until the admin grants it to their role;
        # then they can, without logging in again.
        for role in ("PROCTOR", "FACULTY", "PROGRAM_HEAD", "GUIDANCE_STAFF"):
            with self.subTest(role=role):
                username = f"api_{role.lower()}"
                make_user(role, username, email_verified=True)
                token = _token(self.client, username)

                # 404 for a proctor: without the Exams module the draft isn't even visible.
                self.assertIn(
                    self._edit_exam(token).status_code,
                    (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
                )

                put = self._admin_put(role, {"actions": {"exams.update-any": True}})
                self.assertEqual(put.status_code, status.HTTP_200_OK, put.content)
                self.assertTrue(put.data["actions"]["exams.update-any"])
                self.assertTrue(put.data["modules"]["exams"])

                self._as(token)
                access = self.client.get("/api/auth/access-map/").data
                self.assertIn("exams.update-any", access["permissions"])
                self.assertIn("exams", access["modules"])
                response = self._edit_exam(token, title=f"Edited by {role}")
                self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

                # And turning it back off takes effect just as fast.
                self._admin_put(role, {"actions": {"exams.update-any": False}})
                self.assertEqual(self._edit_exam(token).status_code, status.HTTP_403_FORBIDDEN)

        self.exam.refresh_from_db()
        self.assertEqual(self.exam.title, "Edited by GUIDANCE_STAFF")

    def test_revoking_exams_update_from_a_role_stops_owners_editing(self):
        token = _token(self.client, "api_owner")
        self.assertEqual(self._edit_exam(token).status_code, status.HTTP_200_OK)
        self._admin_put("FACULTY", {"actions": {"exams.update": False}})
        self.assertEqual(self._edit_exam(token).status_code, status.HTTP_403_FORBIDDEN)

    def test_exams_update_alone_still_only_covers_own_exams(self):
        make_user(User.Role.PROGRAM_HEAD, "api_ph_own", email_verified=True)
        token = _token(self.client, "api_ph_own")
        response = self._edit_exam(token)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Edit any exam", str(response.data))

    def test_per_user_grant_from_manage_access_takes_effect(self):
        proctor = make_user(User.Role.PROCTOR, "api_user_grant", email_verified=True)
        token = _token(self.client, "api_user_grant")
        self.client.force_authenticate(user=self.admin)
        put = self.client.put(
            f"/api/auth/users/{proctor.id}/permissions/",
            {"actions": {"exams.update-any": True}},
            format="json",
        )
        self.assertEqual(put.status_code, status.HTTP_200_OK, put.content)
        self.client.force_authenticate(user=None)
        self.assertEqual(self._edit_exam(token).status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.admin)
        detail = self.client.get(f"/api/auth/users/{proctor.id}/permissions/").data
        self.assertEqual(detail["overrides"]["actions"], {"exams.update-any": "grant"})
        self.assertEqual(detail["overrides"]["modules"], {"exams": "grant"})
        self.assertFalse(detail["role_access"]["actions"]["exams.update-any"])

    def test_role_endpoints_are_admin_only(self):
        make_user(User.Role.PROGRAM_HEAD, "api_ph_noadmin", email_verified=True)
        self._as(_token(self.client, "api_ph_noadmin"))
        self.assertEqual(self.client.get("/api/auth/roles/permissions/").status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.put(
            "/api/auth/roles/PROGRAM_HEAD/permissions/",
            {"actions": {"users.force-delete": True}},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_payload_and_reset(self):
        self.client.force_authenticate(user=self.admin)
        data = self.client.get("/api/auth/roles/permissions/").data
        self.assertEqual([r["role"] for r in data["roles"]], service.configurable_roles())
        self.assertIn({"key": "exams.update-any", "label": "Edit any exam", "modules": ["exams"]}, data["actions"])
        proctor = next(r for r in data["roles"] if r["role"] == "PROCTOR")
        self.assertEqual({k for k, v in proctor["actions"].items() if v}, EXPECTED_ACTIONS["PROCTOR"])

        self.client.put(
            "/api/auth/roles/PROCTOR/permissions/", {"actions": {"exams.update-any": True}}, format="json"
        )
        reset = self.client.put("/api/auth/roles/PROCTOR/permissions/", {"reset": True}, format="json")
        self.assertEqual(reset.status_code, status.HTTP_200_OK)
        self.assertEqual(reset.data["actions"], reset.data["defaults"]["actions"])
        self.assertEqual(reset.data["modules"], reset.data["defaults"]["modules"])

    def test_admin_role_is_not_editable(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.put(
            "/api/auth/roles/ADMIN/permissions/", {"actions": {"exams.create": False}}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_report_export_follows_the_permission(self):
        proctor = make_user(User.Role.PROCTOR, "api_exporter")
        self.client.force_authenticate(user=proctor)
        self.assertEqual(self.client.get("/api/reports/export/csv/").status_code, status.HTTP_403_FORBIDDEN)
        service.set_role_permissions("PROCTOR", {}, {"reports.export": True})
        self.client.force_authenticate(user=fresh(proctor))
        self.assertEqual(self.client.get("/api/reports/export/csv/").status_code, status.HTTP_200_OK)


class LegacyGrantMigrationTests(TestCase):
    """0010 turns seeded per-user copies into inheritance, keeping admin edits."""

    def setUp(self):
        self.migration = importlib.import_module(
            "features.authentication.migrations.0010_role_permission"
        )
        service.ensure_registry_permissions()

    def _perm(self, codename):
        return Permission.objects.get(codename=codename, content_type=service._content_type())

    def test_conversion(self):
        admin = make_user(User.Role.ADMIN, "mig_admin")
        # A faculty member demoted to proctor, still holding seeded faculty copies.
        demoted = make_user(User.Role.PROCTOR, "mig_demoted")
        demoted.user_permissions.add(
            self._perm("action_exams_create"), self._perm("action_exams_update")
        )
        # A faculty member with an admin-made grant and an admin revocation.
        faculty = make_user(User.Role.FACULTY, "mig_faculty")
        faculty.user_permissions.add(self._perm("action_exams_create"), self._perm("action_exams_delete"))
        PermissionChange.objects.create(target=faculty, actor=admin, permission="action.exams.delete", action="grant")
        PermissionChange.objects.create(target=faculty, actor=admin, permission="action.exams.update", action="grant")
        PermissionChange.objects.create(target=faculty, actor=admin, permission="action.exams.update", action="revoke")

        self.migration.convert_user_action_grants(django_apps, None)

        demoted, faculty = fresh(demoted), fresh(faculty)
        self.assertEqual(demoted.user_permissions.count(), 0)
        self.assertFalse(service.can(demoted, "exams.create"))
        self.assertEqual(
            set(faculty.user_permissions.values_list("codename", flat=True)),
            {"action_exams_delete", "deny_action_exams_update"},
        )
        self.assertTrue(service.can(faculty, "exams.create"))  # now from the role
        self.assertTrue(service.can(faculty, "exams.delete"))  # admin grant kept
        self.assertFalse(service.can(faculty, "exams.update"))  # admin revoke kept
