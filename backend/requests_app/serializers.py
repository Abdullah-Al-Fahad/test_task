from rest_framework import serializers
from .models import ServiceRequest


class ServiceRequestSerializer(serializers.ModelSerializer):
    operator_username = serializers.CharField(
        source="operator.username", read_only=True
    )

    class Meta:
        model = ServiceRequest
        fields = [
            "id",
            "customer_account",
            "request_type",
            "status",
            "progress",
            "operator_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "status", "progress", "created_at", "updated_at"]

    def validate_customer_account(self, value: str) -> str:
        if len(value.strip()) < 3:
            raise serializers.ValidationError(
                "Customer account must be at least 3 characters long."
            )
        return value.strip()
