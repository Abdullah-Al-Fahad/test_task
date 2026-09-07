from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework_simplejwt.views import TokenRefreshView
from users_app.views import CustomTokenObtainPairView, RegisterView

from django_prometheus.exports import ExportToDjangoView
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),
    re_path(r'^metrics/?$', ExportToDjangoView, name='prometheus-django-metrics'),
    re_path(r'^api/token/?$', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    re_path(r'^api/token/refresh/?$', TokenRefreshView.as_view(), name='token_refresh'),
    re_path(r'^api/register/?$', RegisterView.as_view(), name='register'),
    path('api/', include('requests_app.urls')),
    
    # Swagger API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
