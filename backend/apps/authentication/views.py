from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth import get_user_model

from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserDetailSerializer,
    CustomTokenObtainPairSerializer
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token endpoint that returns user info along with tokens.
    """
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(viewsets.ModelViewSet):
    """
    Endpoint for user registration.
    POST /api/auth/register/ - Create a new user account
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        """Handle user registration."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                'message': 'User registered successfully',
                'user': UserSerializer(user).data
            },
            status=status.HTTP_201_CREATED
        )


class UserProfileViewSet(viewsets.ModelViewSet):
    """
    Endpoints for user profile management.
    GET /api/auth/profile/ - Get current user profile
    PUT /api/auth/profile/ - Update current user profile
    """
    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Only return the current user."""
        return User.objects.filter(id=self.request.user.id)

    @action(detail=False, methods=['get'])
    def me(self, request):
        """
        Get current authenticated user's profile.
        GET /api/auth/profile/me/
        """
        user = request.user
        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=['put', 'patch'])
    def update_profile(self, request):
        """
        Update current user's profile.
        PUT/PATCH /api/auth/profile/update_profile/
        """
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                'message': 'Profile updated successfully',
                'user': serializer.data
            }
        )

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """
        Change user password.
        POST /api/auth/profile/change_password/
        Body: { "old_password": "...", "new_password": "...", "new_password2": "..." }
        """
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        new_password2 = request.data.get('new_password2')

        if not user.check_password(old_password):
            return Response(
                {'error': 'Old password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != new_password2:
            return Response(
                {'error': 'New passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response(
            {'message': 'Password changed successfully'},
            status=status.HTTP_200_OK
        )


class UserListViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint for retrieving user lists (admin only).
    GET /api/users/ - List all users
    GET /api/users/{id}/ - Get user details
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Only allow admins to list all users."""
        if not self.request.user.is_admin():
            return User.objects.filter(id=self.request.user.id)
        return User.objects.all()

