import uuid
from django.db import models
from django.conf import settings


class ServiceRequest(models.Model):
    """
    Core domain entity representing a long-running service request.
    Uses TextChoices to enforce type safety and eliminate magic strings.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PROCESSING = "PROCESSING", "Processing"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"
        CANCELLED = "CANCELLED", "Cancelled"

    class RequestType(models.TextChoices):
        LINE_DIAGNOSTIC = "LINE_DIAGNOSTIC", "Line Diagnostic Test"
        FIRMWARE_UPGRADE = "FIRMWARE_UPGRADE", "Remote Firmware Upgrade"
        NETWORK_PROVISION = "NETWORK_PROVISION", "Network Provisioning"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer_account = models.CharField(max_length=50, default="UNKNOWN")
    request_type = models.CharField(
        max_length=30,
        choices=RequestType.choices,
        default=RequestType.LINE_DIAGNOSTIC,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    progress = models.PositiveSmallIntegerField(default=0)  # 0-100

    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="service_requests",
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Service Request"
        verbose_name_plural = "Service Requests"

    def __str__(self) -> str:
        return f"[{self.status}] {self.get_request_type_display()} for {self.customer_account}"

    @property
    def is_terminal(self) -> bool:
        """Returns True if the request has reached a final state."""
        return self.status in (self.Status.COMPLETED, self.Status.FAILED, self.Status.CANCELLED)
