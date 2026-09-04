import pytest
from rest_framework.test import APIClient
from users_app.models import User


@pytest.mark.django_db
class TestUserAuthAndRegistration:
    def setup_method(self):
        self.client = APIClient()

    def test_register_operator_success(self):
        payload = {
            "username": "new_operator",
            "password": "strongpassword123",
            "role": "OPERATOR"
        }
        res = self.client.post("/api/register/", payload, format="json")
        assert res.status_code == 201
        data = res.json()
        assert data["username"] == "new_operator"
        assert data["role"] == "OPERATOR"
        assert "access" in data
        assert "refresh" in data

        user = User.objects.get(username="new_operator")
        assert user.role == User.Role.OPERATOR
        assert user.check_password("strongpassword123")

    def test_register_supervisor_success(self):
        payload = {
            "username": "new_supervisor",
            "password": "strongpassword123",
            "role": "SUPERVISOR"
        }
        res = self.client.post("/api/register/", payload, format="json")
        assert res.status_code == 201
        data = res.json()
        assert data["username"] == "new_supervisor"
        assert data["role"] == "SUPERVISOR"

        user = User.objects.get(username="new_supervisor")
        assert user.role == User.Role.SUPERVISOR

    def test_register_duplicate_username_fails(self):
        User.objects.create_user(username="existing_user", password="password123")
        payload = {
            "username": "existing_user",
            "password": "newpassword123",
            "role": "OPERATOR"
        }
        res = self.client.post("/api/register/", payload, format="json")
        assert res.status_code == 400

    def test_custom_token_obtain_pair_returns_role(self):
        user = User.objects.create_user(
            username="test_supervisor_jwt",
            password="password123",
            role=User.Role.SUPERVISOR
        )
        res = self.client.post(
            "/api/token/",
            {"username": "test_supervisor_jwt", "password": "password123"},
            format="json"
        )
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "test_supervisor_jwt"
        assert data["role"] == "SUPERVISOR"
        assert "access" in data
        assert "refresh" in data
