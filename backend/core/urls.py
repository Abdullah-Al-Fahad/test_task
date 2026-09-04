from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework_simplejwt.views import TokenRefreshView
from users_app.views import CustomTokenObtainPairView, RegisterView

urlpatterns = [
    path('admin/', admin.site.urls),
    re_path(r'^api/token/?$', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    re_path(r'^api/token/refresh/?$', TokenRefreshView.as_view(), name='token_refresh'),
    re_path(r'^api/register/?$', RegisterView.as_view(), name='register'),
    path('api/', include('requests_app.urls')),
]
