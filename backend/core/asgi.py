import os
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Initialize Django ASGI app early so the AppRegistry is populated
# before any imports that touch ORM models.
django_asgi_app = get_asgi_application()

import requests_app.routing  # noqa: E402 — must come after get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # WebSocket auth is handled inside the consumer (JWT query param),
    # so we use a plain URLRouter without AllowedHostsOriginValidator
    # which blocks connections in development environments.
    "websocket": URLRouter(
        requests_app.routing.websocket_urlpatterns
    ),
})
