from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Lightweight serializer for User listings."""

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "avatar_url",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "avatar_url"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and request is not None:
            return request.build_absolute_uri(obj.avatar.url)
        if obj.avatar:
            return obj.avatar.url
        return None


class UserDetailSerializer(UserSerializer):
    """Detailed serializer used for the authenticated user's own profile."""

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + [
            "phone",
            "institution",
            "student_id",
            "last_seen_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "last_seen_at", "avatar_url"]

    def validate_phone(self, value):
        from shared.utils.validators import validate_phone

        return validate_phone(value)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm Password")
    email = serializers.EmailField()

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "password2",
        ]

    def validate(self, data):
        if data["password"] != data.pop("password2"):
            raise serializers.ValidationError({"password": "Passwords must match."})
        return data

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            password=validated_data["password"],
            role=User.Role.EXAMINEE,
        )


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, data):
        if data["new_password"] != data["new_password2"]:
            raise serializers.ValidationError({"new_password": "New passwords must match."})
        return data


class AvatarUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["avatar"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """JWT token serializer that includes user info + claims."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["role"] = user.role
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
        return data
