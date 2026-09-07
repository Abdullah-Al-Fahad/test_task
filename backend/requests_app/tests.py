import pytest
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APIClient
from rest_framework import status
from requests_app.models import ServiceRequest
from requests_app.services import RequestService

User = get_user_model()


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def operator(db):
    return User.objects.create_user(username="op1", password="password123", role="OPERATOR")


@pytest.fixture
def supervisor(db):
    return User.objects.create_user(username="sup1", password="password123", role="SUPERVISOR")


@pytest.fixture
def auth_client(operator):
    client = APIClient()
    client.force_authenticate(user=operator)
    return client, operator


@pytest.fixture
def sup_client(supervisor):
    client = APIClient()
    client.force_authenticate(user=supervisor)
    return client, supervisor


# ─── Model Tests ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestServiceRequestModel:
    def test_default_status_is_pending(self, operator):
        req = ServiceRequest.objects.create(
            customer_account="ACC-100",
            request_type=ServiceRequest.RequestType.LINE_DIAGNOSTIC,
            operator=operator,
        )
        assert req.status == ServiceRequest.Status.PENDING
        assert req.progress == 0

    def test_is_terminal_states(self, operator):
        req = ServiceRequest.objects.create(
            customer_account="ACC-100",
            operator=operator,
            status=ServiceRequest.Status.PROCESSING,
        )
        assert req.is_terminal is False

        req.status = ServiceRequest.Status.COMPLETED
        assert req.is_terminal is True

        req.status = ServiceRequest.Status.FAILED
        assert req.is_terminal is True

        req.status = ServiceRequest.Status.CANCELLED
        assert req.is_terminal is True

    def test_str_representation(self, operator):
        req = ServiceRequest.objects.create(
            customer_account="ACC-999",
            request_type=ServiceRequest.RequestType.FIRMWARE_UPGRADE,
            operator=operator,
        )
        assert "ACC-999" in str(req)
        assert "Remote Firmware Upgrade" in str(req)


# ─── Service Layer Tests ─────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRequestService:
    def test_operator_sees_only_own_requests(self, operator, supervisor):
        ServiceRequest.objects.create(customer_account="ACC-OP", operator=operator)
        ServiceRequest.objects.create(customer_account="ACC-SUP", operator=supervisor)

        qs = RequestService.get_requests_for_user(operator)
        assert qs.count() == 1
        assert qs.first().customer_account == "ACC-OP"

    def test_supervisor_sees_all_requests(self, operator, supervisor):
        ServiceRequest.objects.create(customer_account="ACC-OP", operator=operator)
        ServiceRequest.objects.create(customer_account="ACC-SUP", operator=supervisor)

        qs = RequestService.get_requests_for_user(supervisor)
        assert qs.count() == 2

    def test_queryset_uses_select_related(self, operator):
        """Verify select_related prevents N+1 queries when accessing operator."""
        for i in range(3):
            ServiceRequest.objects.create(customer_account=f"ACC-{i}", operator=operator)

        qs = RequestService.get_requests_for_user(operator)

        with CaptureQueriesContext(connection) as ctx:
            usernames = [r.operator.username for r in qs]

        assert len(ctx.captured_queries) == 1, (
            f"Expected 1 query with select_related, got {len(ctx.captured_queries)}"
        )

    @patch('core.celery.app.control.revoke')
    @patch('requests_app.tasks._broadcast_update')
    def test_cancel_active_request(self, mock_broadcast, mock_revoke, operator):
        req = ServiceRequest.objects.create(
            customer_account="ACC-CANCEL",
            operator=operator,
            status=ServiceRequest.Status.PROCESSING,
        )
        success = RequestService.cancel_request(req)
        assert success is True
        req.refresh_from_db()
        assert req.status == ServiceRequest.Status.CANCELLED
        mock_revoke.assert_called_once()
        mock_broadcast.assert_called_once()

    def test_cancel_terminal_request_returns_false(self, operator):
        req = ServiceRequest.objects.create(
            customer_account="ACC-COMPLETED",
            operator=operator,
            status=ServiceRequest.Status.COMPLETED,
        )
        success = RequestService.cancel_request(req)
        assert success is False
        req.refresh_from_db()
        assert req.status == ServiceRequest.Status.COMPLETED


# ─── API Tests ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestServiceRequestAPI:
    @patch('requests_app.services.process_service_request')
    @patch('requests_app.tasks._broadcast_update')
    def test_create_request_returns_201(self, mock_broadcast, mock_task, auth_client):
        mock_task.apply_async.return_value = None
        client, _ = auth_client
        res = client.post(
            "/api/requests/",
            {"customer_account": "ACC-TEST-1", "request_type": "LINE_DIAGNOSTIC"}
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert res.data["status"] == ServiceRequest.Status.PENDING
        assert res.data["customer_account"] == "ACC-TEST-1"
        mock_task.apply_async.assert_called_once()
        mock_broadcast.assert_called_once()

    def test_create_request_fails_with_short_account(self, auth_client):
        client, _ = auth_client
        res = client.post(
            "/api/requests/",
            {"customer_account": "A", "request_type": "LINE_DIAGNOSTIC"}
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_request_returns_401(self):
        client = APIClient()
        res = client.get("/api/requests/")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_operator_cannot_see_other_operators_requests(self, auth_client, supervisor):
        client, operator = auth_client
        ServiceRequest.objects.create(customer_account="ACC-SUP", operator=supervisor)
        res = client.get("/api/requests/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["count"] == 0

    def test_supervisor_sees_all_requests(self, sup_client, operator):
        client, supervisor = sup_client
        ServiceRequest.objects.create(customer_account="ACC-OP", operator=operator)
        ServiceRequest.objects.create(customer_account="ACC-SUP", operator=supervisor)
        res = client.get("/api/requests/")
        assert res.status_code == status.HTTP_200_OK
        assert res.data["count"] == 2

    @patch('core.celery.app.control.revoke')
    @patch('requests_app.tasks._broadcast_update')
    def test_cancel_request_api(self, mock_broadcast, mock_revoke, auth_client):
        client, operator = auth_client
        req = ServiceRequest.objects.create(
            customer_account="ACC-CANCEL-API",
            operator=operator,
            status=ServiceRequest.Status.PROCESSING,
        )
        res = client.post(f"/api/requests/{req.id}/cancel/")
        assert res.status_code == status.HTTP_200_OK
        req.refresh_from_db()
        assert req.status == ServiceRequest.Status.CANCELLED

    def test_delete_active_request_returns_400(self, auth_client):
        client, operator = auth_client
        req = ServiceRequest.objects.create(
            customer_account="ACC-DEL-ACT",
            operator=operator,
            status=ServiceRequest.Status.PROCESSING,
        )
        res = client.delete(f"/api/requests/{req.id}/")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "Active diagnostic tasks cannot be deleted" in res.data["detail"]
        assert ServiceRequest.objects.filter(id=req.id).exists()

    def test_delete_terminal_request_succeeds(self, auth_client):
        client, operator = auth_client
        req = ServiceRequest.objects.create(
            customer_account="ACC-DEL-TERM",
            operator=operator,
            status=ServiceRequest.Status.COMPLETED,
        )
        res = client.delete(f"/api/requests/{req.id}/")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not ServiceRequest.objects.filter(id=req.id).exists()

    def test_operator_cannot_delete_other_operator_request(self, auth_client, supervisor):
        client, operator = auth_client
        other_req = ServiceRequest.objects.create(
            customer_account="ACC-OTHER",
            operator=supervisor,
            status=ServiceRequest.Status.COMPLETED,
        )
        res = client.delete(f"/api/requests/{other_req.id}/")
        assert res.status_code == status.HTTP_404_NOT_FOUND
        assert ServiceRequest.objects.filter(id=other_req.id).exists()

    def test_supervisor_can_delete_any_terminal_request(self, sup_client, operator):
        client, supervisor = sup_client
        op_req = ServiceRequest.objects.create(
            customer_account="ACC-OP-TERM",
            operator=operator,
            status=ServiceRequest.Status.CANCELLED,
        )
        res = client.delete(f"/api/requests/{op_req.id}/")
        assert res.status_code == status.HTTP_204_NO_CONTENT
        assert not ServiceRequest.objects.filter(id=op_req.id).exists()

    def test_bulk_delete_endpoint(self, auth_client):
        client, operator = auth_client
        r1 = ServiceRequest.objects.create(
            customer_account="ACC-BULK-1",
            operator=operator,
            status=ServiceRequest.Status.COMPLETED,
        )
        r2 = ServiceRequest.objects.create(
            customer_account="ACC-BULK-2",
            operator=operator,
            status=ServiceRequest.Status.FAILED,
        )
        r3_active = ServiceRequest.objects.create(
            customer_account="ACC-BULK-3",
            operator=operator,
            status=ServiceRequest.Status.PROCESSING,
        )

        res = client.post("/api/requests/bulk-delete/", {
            "ids": [str(r1.id), str(r2.id), str(r3_active.id)]
        }, format="json")

        assert res.status_code == status.HTTP_200_OK
        assert len(res.data["deleted_ids"]) == 2
        assert res.data["active_skipped_count"] == 1
        assert not ServiceRequest.objects.filter(id__in=[r1.id, r2.id]).exists()
        assert ServiceRequest.objects.filter(id=r3_active.id).exists()

    def test_put_is_not_allowed(self, auth_client):
        client, operator = auth_client
        req = ServiceRequest.objects.create(customer_account="ACC-PUT", operator=operator)
        res = client.put(f"/api/requests/{req.id}/", {"customer_account": "ACC-CHANGED"})
        assert res.status_code == status.HTTP_405_METHOD_NOT_ALLOWED

    def test_health_check_endpoint_returns_200(self):
        client = APIClient()
        res = client.get("/api/health/")
        assert res.status_code in [status.HTTP_200_OK, status.HTTP_503_SERVICE_UNAVAILABLE]
        assert "status" in res.data
        assert "services" in res.data
