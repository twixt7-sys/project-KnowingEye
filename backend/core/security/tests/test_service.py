"""Unit tests for the RBAC/PBAC service: role/module/permission checks,
grant/deny/revoke, deny-wins precedence, and role-default seeding.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.security import service

User = get_user_model()


def make_user(role, username):
    return User.objects.create_user(
        username=username,
        email=f"{username}@test.local",
        password="TestPass123!",
        role=role,
    )


class RoleShortCircuitTests(TestCase):
    def test_admin_can_do_everything_without_grants(self):
        admin = make_user(User.Role.ADMIN, "admin1")
        self.assertTrue(service.can(admin, "exams.delete"))
        self.assertTrue(service.has_module(admin, "user-mgmt"))

    def test_unauthenticated_or_none_user_denied(self):
        self.assertFalse(service.can(None, "exams.create"))
        self.assertFalse(service.has_module(None, "dashboard"))


class ModuleAccessTests(TestCase):
    def test_role_default_grants_module(self):
        faculty = make_user(User.Role.FACULTY, "faculty1")
        self.assertTrue(service.has_module(faculty, "exams"))

    def test_role_outside_default_denied(self):
        student = make_user(User.Role.STUDENT, "student1")
        self.assertFalse(service.has_module(student, "exams"))

    def test_explicit_grant_extends_access(self):
        student = make_user(User.Role.STUDENT, "student2")
        self.assertFalse(service.has_module(student, "monitoring"))
        service.grant_module_access(student, "monitoring")
        self.assertTrue(service.has_module(student, "monitoring"))

    def test_explicit_deny_overrides_role_default(self):
        faculty = make_user(User.Role.FACULTY, "faculty2")
        self.assertTrue(service.has_module(faculty, "exams"))
        service.deny_module_access(faculty, "exams")
        self.assertFalse(service.has_module(faculty, "exams"))

    def test_deny_wins_even_after_grant(self):
        student = make_user(User.Role.STUDENT, "student3")
        service.grant_module_access(student, "monitoring")
        self.assertTrue(service.has_module(student, "monitoring"))
        service.deny_module_access(student, "monitoring")
        self.assertFalse(service.has_module(student, "monitoring"))

    def test_revoke_falls_back_to_role_default(self):
        faculty = make_user(User.Role.FACULTY, "faculty3")
        service.deny_module_access(faculty, "exams")
        self.assertFalse(service.has_module(faculty, "exams"))
        service.revoke_module_override(faculty, "exams")
        self.assertTrue(service.has_module(faculty, "exams"))


class ActionPermissionTests(TestCase):
    def test_no_grant_denied_by_default(self):
        student = make_user(User.Role.STUDENT, "student4")
        self.assertFalse(service.can(student, "exams.create"))

    def test_grant_then_revoke(self):
        sa = make_user(User.Role.PROCTOR, "sa1")
        self.assertFalse(service.can(sa, "behavior.resolve"))
        service.grant_action(sa, "behavior.resolve")
        self.assertTrue(service.can(sa, "behavior.resolve"))
        service.revoke_action(sa, "behavior.resolve")
        self.assertFalse(service.can(sa, "behavior.resolve"))


class RoleDefaultsTests(TestCase):
    def test_apply_role_defaults_grants_faculty_starter_set(self):
        faculty = make_user(User.Role.FACULTY, "faculty4")
        service.apply_role_defaults(faculty)
        self.assertTrue(service.can(faculty, "exams.create"))
        self.assertTrue(service.can(faculty, "exams.update"))
        self.assertTrue(service.can(faculty, "behavior.resolve"))

    def test_apply_role_defaults_is_additive_and_idempotent(self):
        faculty = make_user(User.Role.FACULTY, "faculty5")
        service.apply_role_defaults(faculty)
        service.revoke_action(faculty, "behavior.resolve")
        self.assertFalse(service.can(faculty, "behavior.resolve"))

        # Re-running defaults must not resurrect a grant an admin revoked.
        service.apply_role_defaults(faculty)
        self.assertFalse(service.can(faculty, "behavior.resolve"))
        self.assertTrue(service.can(faculty, "exams.create"))

    def test_apply_role_defaults_noop_for_admin(self):
        admin = make_user(User.Role.ADMIN, "admin2")
        service.apply_role_defaults(admin)
        self.assertEqual(admin.user_permissions.count(), 0)

    def test_student_gets_no_default_grants(self):
        student = make_user(User.Role.STUDENT, "student5")
        service.apply_role_defaults(student)
        self.assertEqual(student.user_permissions.count(), 0)


class ListUserAccessTests(TestCase):
    def test_shape_and_admin_gets_every_permission(self):
        admin = make_user(User.Role.ADMIN, "admin3")
        access = service.list_user_access(admin)
        self.assertEqual(access["role"], User.Role.ADMIN)
        self.assertIn("user-mgmt", access["modules"])
        from core.security.permissions_registry import PERMISSIONS

        self.assertEqual(set(access["permissions"]), PERMISSIONS)

    def test_faculty_sees_only_granted_permissions(self):
        faculty = make_user(User.Role.FACULTY, "faculty6")
        service.apply_role_defaults(faculty)
        access = service.list_user_access(faculty)
        self.assertIn("exams.create", access["permissions"])
        self.assertNotIn("users.view", access["permissions"])
        self.assertIn("exams", access["modules"])
        self.assertNotIn("user-mgmt", access["modules"])
