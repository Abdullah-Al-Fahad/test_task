from rest_framework import permissions

from users_app.models import User


class IsSupervisor(permissions.BasePermission):
    """Grants access only to users with the SUPERVISOR role."""
    message = "Only Supervisors can perform this action."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.SUPERVISOR
        )


class IsOperator(permissions.BasePermission):
    """Grants access only to users with the OPERATOR role."""
    message = "Only Operators can perform this action."

    def has_permission(self, request, view) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.Role.OPERATOR
        )


class IsOwnerOrSupervisor(permissions.BasePermission):
    """
    Object-level permission.
    Supervisors can read any request.
    Operators can only read/mutate their own.
    """
    def has_object_permission(self, request, view, obj) -> bool:
        if request.user.role == User.Role.SUPERVISOR:
            return True
        return obj.operator == request.user
