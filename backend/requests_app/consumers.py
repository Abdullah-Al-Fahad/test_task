import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()
logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_key: str):
    """
    Validates a JWT access token and returns the corresponding User.
    Returns AnonymousUser on any validation failure.
    """
    try:
        token = AccessToken(token_key)
        user_id = token["user_id"]
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist) as exc:
        logger.warning("WebSocket auth failed: %s", exc)
        return AnonymousUser()


class RequestConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time ServiceRequest updates.

    Authentication: Expects a JWT token passed as a query parameter:
        ws://host/ws/requests/?token=<access_token>

    Only authenticated users are accepted. The connection is rejected
    with code 4001 for unauthenticated or invalid tokens.
    """

    GROUP_NAME = "requests_updates"

    async def connect(self):
        # Authenticate via token query param
        query_string = self.scope.get("query_string", b"").decode()
        params = parse_qs(query_string)
        token_key = params.get("token", [None])[0]

        if not token_key:
            logger.warning("WebSocket connection rejected: no token provided.")
            await self.close(code=4001)
            return

        self.scope["user"] = await get_user_from_token(token_key)

        if isinstance(self.scope["user"], AnonymousUser):
            logger.warning("WebSocket connection rejected: invalid token.")
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.GROUP_NAME, self.channel_name)
        await self.accept()
        logger.info(
            "WebSocket accepted for user=%s", self.scope["user"].username
        )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.GROUP_NAME, self.channel_name)

    # Handler for messages broadcast from the Celery task via Redis
    async def request_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "update",
            "data": event["message"],
        }))

    # Handler for deletion events broadcast via Redis
    async def request_deleted(self, event):
        await self.send(text_data=json.dumps({
            "type": "deleted",
            "data": event["message"],
        }))

