#routing.py
from django.urls import re_path
from dictation.consumers import SpeechToTextConsumer

websocket_urlpatterns = [
    re_path(r"^ws/dictation/$", SpeechToTextConsumer.as_asgi()),
]

#match ws/dication to the correct path.
