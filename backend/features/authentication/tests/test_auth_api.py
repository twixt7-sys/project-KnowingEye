from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from shared.tests.helpers import sample_avatar_file, validation_details

User = get_user_model()


class AuthenticationAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_test",
            email="admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.examinee = User.objects.create_user(
            username="examinee_test",
            email="student@test.local",
            password="TestPass123!",
            role=User.Role.EXAMINEE,
        )

    def test_login_returns_jwt(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(
            url,
            {"username": "examinee_test", "password": "TestPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

    def test_register_examinee(self):
        url = "/api/auth/register/"
        response = self.client.post(
            url,
            {
                "username": "new_student",
                "email": "new@test.local",
                "password": "TestPass123!",
                "password2": "TestPass123!",
                "first_name": "New",
                "last_name": "Student",
                "avatar": sample_avatar_file(),
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="new_student").exists())
        user = User.objects.get(username="new_student")
        self.assertEqual(user.role, User.Role.EXAMINEE)
        self.assertTrue(user.avatar)

    def test_register_rejects_admin_role_escalation(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "evil_admin",
                "email": "evil@test.local",
                "password": "TestPass123!",
                "password2": "TestPass123!",
                "first_name": "Evil",
                "last_name": "Admin",
                "avatar": sample_avatar_file(),
                "role": User.Role.ADMIN,
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="evil_admin")
        self.assertEqual(user.role, User.Role.EXAMINEE)

    def test_register_requires_avatar(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "no_photo",
                "email": "nophoto@test.local",
                "password": "TestPass123!",
                "password2": "TestPass123!",
                "first_name": "No",
                "last_name": "Photo",
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        details = validation_details(response)
        self.assertIn("avatar", details)

    def test_profile_me(self):
        self.client.force_authenticate(user=self.examinee)
        response = self.client.get("/api/auth/profile/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "examinee_test")
        self.assertIn("avatar_url", response.data)

    def test_profile_update(self):
        self.client.force_authenticate(user=self.examinee)
        response = self.client.patch(
            "/api/auth/profile/update_profile/",
            {"first_name": "Updated", "phone": "+63-900-0000"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.examinee.refresh_from_db()
        self.assertEqual(self.examinee.first_name, "Updated")
        self.assertEqual(self.examinee.phone, "+63-900-0000")

    def test_change_password(self):
        self.client.force_authenticate(user=self.examinee)
        response = self.client.post(
            "/api/auth/profile/change-password/",
            {
                "old_password": "TestPass123!",
                "new_password": "BrandNewPass!9",
                "new_password2": "BrandNewPass!9",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.examinee.refresh_from_db()
        self.assertTrue(self.examinee.check_password("BrandNewPass!9"))

    def test_token_refresh_endpoint_exists(self):
        login = self.client.post(
            "/api/auth/token/",
            {"username": "examinee_test", "password": "TestPass123!"},
            format="json",
        )
        refresh = login.data.get("refresh")
        response = self.client.post(
            "/api/auth/token/refresh/", {"refresh": refresh}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
