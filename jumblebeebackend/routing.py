#routing.py
from django.urls import re_path
from dictation.consumers import DictationConsumer

websocket_urlpatterns = [
    re_path(r"^ws/dictation/$", DictationConsumer.as_asgi()),
] #match ws/dication to the correct path.
