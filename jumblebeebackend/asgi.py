# myproject/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

from .routing import websocket_urlpatterns

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jumblebeebackend.settings") #settings file.

django_asgi_app = get_asgi_application() #Build an ASGI application.

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
}) #route traffic depending on type, http goes to ordinary Django, WebSocket goes to WebSocket URL.
