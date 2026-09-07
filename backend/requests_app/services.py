import logging

from django.db import models

from .models import ServiceRequest
from .tasks import process_service_request

logger = logging.getLogger(__name__)


class RequestService:
    """
    Service layer for ServiceRequest business logic.
    This decouples all business rules from the HTTP transport layer (views).
    Views are thin; all intelligence lives here.
    """

    @staticmethod
    def create_request(user, customer_account: str, request_type: str) -> ServiceRequest:
        """
        Creates a ServiceRequest and immediately enqueues the processing task.
        The task ID is passed as a string to ensure JSON serialisability.
        """
        req = ServiceRequest.objects.create(
            customer_account=customer_account,
            request_type=request_type,
            operator=user,
        )

        from .tasks import _broadcast_update
        from channels.layers import get_channel_layer
        _broadcast_update(
            get_channel_layer(),
            req,
            log_message=f"[QUEUED] Request received and scheduled for execution."
        )

        # str() cast is critical: UUID is not JSON-serialisable by default
        # We explicitly set task_id to req.id so we can revoke it later easily.
        process_service_request.apply_async(args=[str(req.id)], task_id=str(req.id))

        logger.info(
            "Created ServiceRequest id=%s for operator=%s, task dispatched.",
            req.id,
            user.username,
        )
        return req
    @staticmethod
    def cancel_request(req: ServiceRequest) -> bool:
        """
        Cancels a pending or processing request by revoking the Celery task
        and updating the database status. Returns True if cancelled.
        """
        if req.is_terminal:
            return False

        from core.celery import app
        # Terminate immediately kills the worker process handling this task
        app.control.revoke(str(req.id), terminate=True, signal="SIGKILL")
        
        req.status = ServiceRequest.Status.CANCELLED
        req.save(update_fields=["status", "updated_at"])
        
        from .tasks import _broadcast_update
        from channels.layers import get_channel_layer
        _broadcast_update(get_channel_layer(), req, log_message="[WARN] Request cancelled by user.")
        
        logger.info("ServiceRequest id=%s cancelled.", req.id)
        return True
    @staticmethod
    def get_requests_for_user(user) -> models.QuerySet:
        """
        Returns the appropriate queryset based on the caller's role.
        select_related('operator') prevents N+1 queries from the serialiser
        accessing operator.username on each row.

        - SUPERVISOR: sees all requests system-wide.
        - OPERATOR: sees only their own requests.
        """
        base_qs = ServiceRequest.objects.select_related("operator")

        from users_app.models import User
        if user.role == User.Role.SUPERVISOR:
            return base_qs.all()

        return base_qs.filter(operator=user)

    @staticmethod
    def delete_request(req: ServiceRequest) -> bool:
        """
        Safely deletes a terminal request and broadcasts the removal event
        to the Redis channel layer so connected clients sync in real time.
        Non-terminal requests cannot be deleted to prevent Celery worker corruption.
        """
        if not req.is_terminal:
            raise ValueError("Active diagnostic tasks cannot be deleted. Cancel the task first.")

        req_id = str(req.id)
        req.delete()

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "requests_updates",
                {
                    "type": "request_deleted",
                    "message": {"id": req_id},
                },
            )

        logger.info("ServiceRequest id=%s deleted.", req_id)
        return True

    @staticmethod
    def bulk_delete_requests(user, ids: list[str]) -> tuple[list[str], int]:
        """
        Bulk deletes terminal requests matching the given IDs and accessible
        by the given user role. Non-terminal requests are preserved.
        Returns a tuple of (deleted_ids, active_skipped_count).
        """
        user_qs = RequestService.get_requests_for_user(user).filter(id__in=ids)
        
        terminal_qs = user_qs.filter(status__in=[
            ServiceRequest.Status.COMPLETED,
            ServiceRequest.Status.FAILED,
            ServiceRequest.Status.CANCELLED,
        ])
        
        deleted_ids = [str(r.id) for r in terminal_qs]
        active_skipped_count = user_qs.exclude(id__in=deleted_ids).count()
        
        if deleted_ids:
            terminal_qs.delete()
            
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    "requests_updates",
                    {
                        "type": "request_deleted",
                        "message": {"ids": deleted_ids},
                    },
                )
            logger.info(
                "Bulk deleted %d requests for user=%s (skipped %d active).",
                len(deleted_ids),
                user.username,
                active_skipped_count,
            )

        return deleted_ids, active_skipped_count

