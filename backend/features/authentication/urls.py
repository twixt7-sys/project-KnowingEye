from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from .views import (
    CustomTokenObtainPairView,
    RegisterView,
    UserListViewSet,
    UserProfileViewSet,
)


router = DefaultRouter()
router.register(r"register", RegisterView, basename="register")
router.register(r"profile", UserProfileViewSet, basename="profile")
router.register(r"users", UserListViewSet, basename="users")


urlpatterns = [
    path("token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    path("", include(router.urls)),
]
