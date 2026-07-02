"""Authentication & profile management endpoints."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    AvatarUploadSerializer,
    CustomTokenObtainPairSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserDetailSerializer,
    UserSerializer,
)


User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """JWT login that returns user info alongside the access/refresh pair."""

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            username = request.data.get("username")
            if username:
                User.objects.filter(username=username).update(last_seen_at=timezone.now())
        return response


class RegisterView(viewsets.ModelViewSet):
    """POST /api/auth/register/ - public account creation."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["post"]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "message": "User registered successfully",
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserProfileViewSet(viewsets.ViewSet):
    """Endpoints for the currently authenticated user's profile."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @action(detail=False, methods=["get"])
    def me(self, request):
        serializer = UserDetailSerializer(request.user, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["put", "patch"])
    def update_profile(self, request):
        serializer = UserDetailSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Profile updated successfully", "user": serializer.data}
        )

    @action(detail=False, methods=["post"], url_path="change-password")
    def change_password(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"old_password": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"message": "Password changed successfully"})

    @action(detail=False, methods=["post"], url_path="avatar")
    def upload_avatar(self, request):
        serializer = AvatarUploadSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            UserDetailSerializer(request.user, context={"request": request}).data
        )


class UserListViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-scoped user listing + lightweight admin actions.

    Non-admins only ever see their own record. Admins can additionally
    toggle activation and change roles via dedicated POST actions.
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not self.request.user.is_admin():
            return User.objects.filter(id=self.request.user.id)
        qs = User.objects.all().order_by("-date_joined")
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(username__icontains=search) | qs.filter(
                email__icontains=search
            )
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def _require_admin(self):
        if not self.request.user.is_admin():
            return Response(
                {"detail": "Admin only."}, status=status.HTTP_403_FORBIDDEN
            )
        return None

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        denied = self._require_admin()
        if denied:
            return denied
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        denied = self._require_admin()
        if denied:
            return denied
        user = self.get_object()
        if user == request.user:
            return Response(
                {"detail": "Refusing to deactivate the current admin account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="set-role")
    def set_role(self, request, pk=None):
        denied = self._require_admin()
        if denied:
            return denied
        new_role = (request.data or {}).get("role")
        valid = {choice for choice, _ in User.Role.choices}
        if new_role not in valid:
            return Response(
                {"detail": f"Invalid role. Choose one of {sorted(valid)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = self.get_object()
        user.role = new_role
        user.save(update_fields=["role"])
        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Aggregate user counts for admin dashboards (not affected by search)."""
        denied = self._require_admin()
        if denied:
            return denied
        qs = User.objects.all()
        return Response(
            {
                "total": qs.count(),
                "admins": qs.filter(role=User.Role.ADMIN).count(),
                "examinees": qs.filter(role=User.Role.EXAMINEE).count(),
                "inactive": qs.filter(is_active=False).count(),
            }
        )
