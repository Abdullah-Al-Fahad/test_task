from rest_framework import mixins, viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ServiceRequest
from .permissions import IsOwnerOrSupervisor
from .serializers import ServiceRequestSerializer
from .services import RequestService


class ServiceRequestViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    ViewSet for ServiceRequests. Intentionally excludes Update and Destroy
    mixin — status transitions are owned by the system (Celery tasks), not
    by direct HTTP mutation. This enforces the single-responsibility principle
    on state management.

    GET  /api/requests/       → list (role-filtered by RequestService)
    GET  /api/requests/<id>/  → retrieve (with object-level permission check)
    POST /api/requests/       → create + dispatch background task
    """

    serializer_class = ServiceRequestSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrSupervisor]

    def get_queryset(self):
        return RequestService.get_requests_for_user(self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        req = RequestService.create_request(
            user=request.user,
            customer_account=serializer.validated_data["customer_account"],
            request_type=serializer.validated_data["request_type"],
        )

        return Response(
            self.get_serializer(req).data,
            status=status.HTTP_201_CREATED,
        )

    from rest_framework.decorators import action

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        req = self.get_object()
        
        if req.is_terminal:
            return Response(
                {"detail": "Cannot cancel a request that is already terminal."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        success = RequestService.cancel_request(req)
        if success:
            return Response({"detail": "Request cancelled successfully."})
        return Response(
            {"detail": "Failed to cancel request."},
            status=status.HTTP_400_BAD_REQUEST
        )
