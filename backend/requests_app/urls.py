from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ServiceRequestViewSet, HealthCheckView

class OptionalSlashRouter(DefaultRouter):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = '/?'

router = OptionalSlashRouter()
router.register(r'requests', ServiceRequestViewSet, basename='requests')
router.register(r'health', HealthCheckView, basename='health')

urlpatterns = [
    path('', include(router.urls)),
]
