from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer that adds user role and username directly
    to the response payload and token claims.
    """
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["username"] = self.user.username
        data["role"] = self.user.role
        return data


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.OPERATOR)

    class Meta:
        model = User
        fields = ["id", "username", "password", "role"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
            role=validated_data.get("role", User.Role.OPERATOR),
        )
        refresh = RefreshToken.for_user(user)
        refresh["username"] = user.username
        refresh["role"] = user.role

        return {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
