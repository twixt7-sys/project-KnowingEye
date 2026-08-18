"""Authentication & profile management endpoints."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from core.security import service as security
from core.security.drf import HasRole
from core.security.modules import MODULES
from core.security.permissions_registry import PERMISSIONS

from .serializers import (
    AvatarUploadSerializer,
    CustomTokenObtainPairSerializer,
    PasswordChangeSerializer,
    RegisterSerializer,
    UserDetailSerializer,
    UserSerializer,
)


User = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def access_map(request):
    """GET /api/auth/access-map/ - this user's role, modules, and permissions.

    The single source of truth the frontend uses to build nav and gate
    routes/controls, so it can never drift from what the backend enforces.
    """
    return Response(security.list_user_access(request.user))


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

    @action(detail=False, methods=["post"], url_path="verify-email/request")
    def request_email_verification(self, request):
        """Send (or resend) the OTP code for the current user's email."""
        from .otp_service import issue_otp

        if request.user.email_verified:
            return Response({"message": "Email is already verified."})
        issue_otp(request.user)
        return Response({"message": f"A verification code was sent to {request.user.email}."})

    @action(detail=False, methods=["post"], url_path="verify-email/confirm")
    def confirm_email_verification(self, request):
        """Confirm the OTP code and mark the current user's email verified."""
        from .otp_service import verify_otp

        code = (request.data.get("code") or "").strip()
        if not code:
            return Response({"code": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)
        verify_otp(request.user, code)
        return Response(
            {
                "message": "Email verified.",
                "user": UserDetailSerializer(request.user, context={"request": request}).data,
            }
        )

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
    """User listing + lightweight management actions, PBAC-gated.

    Users without ``users.view`` only ever see their own record. Mutating
    actions (activate/deactivate/set-role/etc.) each require their own
    fine-grained permission, so an admin can delegate a subset of user
    management to another role without handing over full admin rights.
    """

    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if not security.can(self.request.user, "users.view"):
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

    def _require(self, action_name: str):
        if not security.can(self.request.user, action_name):
            return Response(
                {"detail": "You do not have permission to perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        denied = self._require("users.toggle-status")
        if denied:
            return denied
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        denied = self._require("users.toggle-status")
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
        denied = self._require("users.update")
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
        # Additive: seeds the new role's starter grants without touching any
        # customisations already made from Manage Access.
        security.apply_role_defaults(user)
        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Aggregate user counts for admin dashboards (not affected by search)."""
        denied = self._require("users.view")
        if denied:
            return denied
        qs = User.objects.all()
        return Response(
            {
                "total": qs.count(),
                "admins": qs.filter(role=User.Role.ADMIN).count(),
                "guidance_staff": qs.filter(role=User.Role.GUIDANCE_STAFF).count(),
                "program_heads": qs.filter(role=User.Role.PROGRAM_HEAD).count(),
                "faculty": qs.filter(role=User.Role.FACULTY).count(),
                "proctors": qs.filter(role=User.Role.PROCTOR).count(),
                "students": qs.filter(role=User.Role.STUDENT).count(),
                "inactive": qs.filter(is_active=False).count(),
            }
        )

    @action(
        detail=True,
        methods=["get", "put"],
        url_path="permissions",
        permission_classes=[IsAuthenticated, HasRole("admin")],
    )
    def permissions(self, request, pk=None):
        """Manage Access: view/set per-user module + action overrides.

        Admin only - delegation itself is never delegable, mirroring OSAS's
        ``role:super_admin``-gated ``UserPermissionController``.

        PUT body: {"modules": {"<module>": "grant"|"deny"|null}, "actions":
        {"<action>": true|false}}. ``null``/omitted clears an override,
        falling back to the role default.
        """
        user = self.get_object()

        if request.method == "GET":
            return Response(
                {
                    "role": user.role,
                    "modules": {
                        m: ("grant" if security.has_module(user, m) else "deny")
                        for m in MODULES
                    },
                    "actions": {p: security.can(user, p) for p in PERMISSIONS},
                }
            )

        modules = (request.data or {}).get("modules") or {}
        actions = (request.data or {}).get("actions") or {}

        for module, state in modules.items():
            if module not in MODULES:
                continue
            if state == "grant":
                security.grant_module_access(user, module, actor=request.user)
            elif state == "deny":
                security.deny_module_access(user, module, actor=request.user)
            else:
                security.revoke_module_override(user, module, actor=request.user)

        for action_name, enabled in actions.items():
            if action_name not in PERMISSIONS:
                continue
            if enabled:
                security.grant_action(user, action_name, actor=request.user)
            else:
                security.revoke_action(user, action_name, actor=request.user)

        return Response(security.list_user_access(user))
