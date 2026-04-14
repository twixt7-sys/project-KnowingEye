from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CustomTokenObtainPairView,
    RegisterView,
    UserProfileViewSet,
    UserListViewSet
)

router = DefaultRouter()
router.register(r'register', RegisterView, basename='register')
router.register(r'profile', UserProfileViewSet, basename='profile')
router.register(r'users', UserListViewSet, basename='users')

urlpatterns = [
    # JWT Token endpoints
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Authentication endpoints
    path('', include(router.urls)),
]
