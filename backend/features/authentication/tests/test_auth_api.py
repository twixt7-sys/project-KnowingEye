from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="new_student").exists())
