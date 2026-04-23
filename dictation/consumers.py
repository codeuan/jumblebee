# dictation/consumers.py
import asyncio
import json
import os
from channels.generic.websocket import AsyncWebsocketConsumer

from vosk import Model, KaldiRecognizer, SetLogLevel

SetLogLevel(0)

# Load model once at import time (important for performance)
VOSK_MODEL_PATH = os.environ.get("VOSK_MODEL_PATH", "vosk-model")
model = Model(VOSK_MODEL_PATH)


class SpeechToTextConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

        # Store expected sample rate. (Most Vosk models expect 16000.)
        # If the incoming audio isn't 16k, you must resample before this point.
        self.sample_rate = 16000

        self.recognizer = KaldiRecognizer(model, self.sample_rate)
        self.recognizer.SetWords(True)

        await self.send(text_data=json.dumps({"type": "ready", "sample_rate": self.sample_rate}))

    async def receive(self, text_data=None, bytes_data=None):
        # If client sent JSON text
        if text_data is not None:
          try:
              payload = json.loads(text_data)
          except json.JSONDecodeError:
              await self.send(text_data=json.dumps({"type": "error", "error": "invalid_json"}))
              return

          if payload.get("action") == "stop":
              # Flush vosk and return final transcript
              final_json = self.recognizer.FinalResult()
              try:
                  final_data = json.loads(final_json)
              except json.JSONDecodeError:
                  final_data = {"text": ""}

              await self.send(text_data=json.dumps({"type": "final", "text": final_data.get("text", "")}))
              await self.close()
              return

          # Ignore other JSON actions for now
          return

        # If client sent audio bytes
        if bytes_data is not None:
            loop = asyncio.get_running_loop()

            # Offload AcceptWaveform to thread pool (CPU-bound)
            accept = await loop.run_in_executor(None, self.recognizer.AcceptWaveform, bytes_data)

            if accept:
                # Complete segment
                result_json = self.recognizer.Result()
                try:
                    result_data = json.loads(result_json)
                except json.JSONDecodeError:
                    result_data = {"text": ""}

                text = result_data.get("text", "")
                if text:
                    await self.send(text_data=json.dumps({"type": "segment", "text": text}))
            else:
                # Partial segment (optional: you can stream partials too)
                partial_json = self.recognizer.PartialResult()
                try:
                    partial_data = json.loads(partial_json)
                except json.JSONDecodeError:
                    partial_data = {"partial": ""}

                # If you want live partial captions, uncomment:
                # partial = partial_data.get("partial", "")
                # if partial:
                #     await self.send(text_data=json.dumps({"type": "partial", "text": partial}))
