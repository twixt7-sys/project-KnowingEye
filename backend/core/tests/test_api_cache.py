from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from features.exams.models import Department

User = get_user_model()

LOCMEM = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "api-cache-tests",
    }
}


@override_settings(CACHES=LOCMEM)
class ApiCacheTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            username="cache_admin",
            email="cache_admin@test.local",
            password="TestPass123!",
            role=User.Role.ADMIN,
        )
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        cache.clear()

    def test_report_summary_is_served_from_cache(self):
        first = self.client.get("/api/reports/summary/")
        second = self.client.get("/api/reports/summary/")
        self.assertEqual(first["X-Cache"], "MISS")
        self.assertEqual(second["X-Cache"], "HIT")
        self.assertEqual(first.json(), second.json())

    @override_settings(API_CACHE_TTL_SECONDS=0)
    def test_report_cache_can_be_disabled(self):
        response = self.client.get("/api/reports/summary/")
        self.assertNotIn("X-Cache", response)

    def test_report_cache_is_not_shared_between_unprivileged_users(self):
        a = User.objects.create_user(
            username="stu_a", email="a@test.local", password="x", role=User.Role.STUDENT
        )
        b = User.objects.create_user(
            username="stu_b", email="b@test.local", password="x", role=User.Role.STUDENT
        )
        self.client.force_authenticate(a)
        self.client.get("/api/reports/summary/")
        self.client.force_authenticate(b)
        self.assertEqual(self.client.get("/api/reports/summary/")["X-Cache"], "MISS")

    def test_unauthenticated_requests_never_hit_cache(self):
        self.client.get("/api/reports/summary/")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/reports/summary/").status_code, 401)

    def test_department_list_cached_and_invalidated_on_write(self):
        Department.objects.create(name="Psychology", abbreviation="PSY")
        self.assertEqual(self.client.get("/api/departments/")["X-Cache"], "MISS")
        self.assertEqual(self.client.get("/api/departments/")["X-Cache"], "HIT")

        Department.objects.create(name="Nursing", abbreviation="NUR")
        response = self.client.get("/api/departments/")
        self.assertEqual(response["X-Cache"], "MISS")
        body = response.json()
        names = {d["name"] for d in (body.get("results") if isinstance(body, dict) else body)}
        self.assertIn("Nursing", names)

    def test_query_string_is_part_of_the_cache_key(self):
        self.client.get("/api/departments/")
        self.assertEqual(
            self.client.get("/api/departments/?active_only=1")["X-Cache"], "MISS"
        )
