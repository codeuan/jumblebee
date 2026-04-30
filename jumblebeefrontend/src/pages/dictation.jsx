//dictation.jsx
import { useCallback, useRef, useState } from "react";
import TextRender from "./textrender";

export default function Dictation() {
  const dictation = useDictation({
    wsPath: "ws://127.0.0.1:8000/ws/dictation/",
  });

  return (
    <TextRender
      dictation={dictation}
      correctWord="jumble"
    />
  );
}

function downsampleBuffer(float32Buffer, inputSampleRate, targetSampleRate) {


  const ratio = inputSampleRate / targetSampleRate; //how many input samples correspond to an output sample.


  const newLength = Math.round(float32Buffer.length / ratio); //compute the number of samples required.
  const result = new Float32Array(newLength); //array storing downsampled samples.

  let offsetResult = 0; //start at 0 in the output array.
  let offsetBuffer = 0; //start at 0 in the input array.

  while (offsetResult < result.length) { //until output array is filled.
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio); //work out where bundle of input samples should end.
    let sum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Buffer.length; i++) {
      sum += float32Buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? sum / count : 0;

    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
    //take multiple input samples and output ONE output sample.
  }

  return result; //return downsampled audio.
}


export function convertTo16BitPCM(float32Samples) {
  const buffer = new ArrayBuffer(float32Samples.length * 2); //create a blank binary buffer with however many bytes our input chunk is.
  const view = new DataView(buffer); //wrap ArrayBuffer so it can be interpreted and controlled.

  let offset = 0; //start at 0 in the buffer.
  for (let i = 0; i < float32Samples.length; i++, offset += 2) { //move write position by 2 each time because we are adding 2 bytes per time to the binary buffer.
    let s = Math.max(-1, Math.min(1, float32Samples[i])); //clamp the input to be between -1 and 1 to normalise.
    const int16 = s < 0 ? s * 0x8000 : s * 0x7fff; //convert value to a 16 bit integer.

    view.setInt16(offset, int16, true); //write number into byte buffer, using little-endian order.
  }

  return buffer; // return ArrayBuffer
}


export function useDictation({ wsPath = "/ws/dictation/", targetSampleRate = 16000,} = {}) //store URL path of WebSocket and the sample rate required.

{
  const [finalTranscript, setFinalTranscript] = useState(""); //store the final predicted phrase.
  const [isRecording, setIsRecording] = useState(false); //flags whether recording is happening.
  const wsRef = useRef(null); //stores WebSocket object.
  const audioContextRef = useRef(null); //stores audio engine AudioContext.
  const processorRef = useRef(null); //stores processor node.
  const sourceRef = useRef(null); //stores microphone source node.
  const streamRef = useRef(null); //stores MediaStream, the actual stream from the microphone.

  const start = useCallback(async () => {
    if (isRecording) return; //do not continue if we are recording, avoid duplicates.
    setFinalTranscript("");   // clear previous transcript


    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;

    const wsUrl =
      wsPath.startsWith("ws://") || wsPath.startsWith("wss://")
        ? wsPath
        : `${scheme}://${host}${wsPath}`;
    //translate the website URL into the WebSocket URL.
  
    const ws = new WebSocket(wsUrl); //begin a WebSocket connection.
    wsRef.current = ws; //store WebSocket object to survive re renders.

    ws.onmessage = (event) => {
      //when data arrives from the server.
      let msg; //declare JSON object.
      try {
        msg = JSON.parse(event.data); //attempt to parse data as JSON.
      } catch {
        return; //if unsuccesful, ignore.
      }

      if (msg.type === "ready") return; //ignore any ready signals.

      if (typeof msg.text === "string") { //if message is a string (the correct format).
        const cleaned = msg.text.replace(/\s+/g, " ").trim(); //clean text.
        if (cleaned.length > 0) { //if cleaned text not empty.
          setFinalTranscript((prev) => (prev ? `${prev} ${cleaned}` : cleaned)); //display final predicted phrase.
        }
      }
    };

    ws.onopen = async () => { //run when a connection opened.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); //obtain microphone permission and create MediaStream.
        streamRef.current = stream; //persist MediaStream to survive re renders.

        const audioContext = new AudioContext({ sampleRate: targetSampleRate }); //create AudioContext and request a particular sample rate.
        audioContextRef.current = audioContext; //persist AudioContext to survive re renders.

    
        const sourceNode = audioContext.createMediaStreamSource(stream); //create audio node from microphone stream.
        sourceRef.current = sourceNode; //persist to survive re renders.

        const bufferSize = 4096; //define how many audio samples to handle each callback.
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        processorRef.current = processor; //create a ScriptProcessor and persist.

        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

          const input = e.inputBuffer.getChannelData(0); // Float32Array

          // Downsample to 16k if needed
          const downsampled = downsampleBuffer(input, audioContext.sampleRate, targetSampleRate);

          // Float32 -> Int16 PCM
          const pcm16 = convertTo16BitPCM(downsampled);

          // Send binary audio frame
          wsRef.current.send(pcm16); // ArrayBuffer is valid input :contentReference[oaicite:5]{index=5}
        };

        // connect graph
        sourceNode.connect(processor);
        processor.connect(audioContext.destination);

        setIsRecording(true);
      } catch (err) {
        console.error("Dictation start failed:", err);
        // If mic permission denied etc, clean up
        setIsRecording(false);
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
    };

    ws.onclose = () => {
      // If backend closes, reflect state
      setIsRecording(false);
    };
  }, [isRecording, targetSampleRate, wsPath]);

  const stop = useCallback(async () => {
    // warn backend + close ws
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "stop" }));
      ws.close();
    }

    // disconnect nodes
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }

    // close AudioContext
    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }

    // stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // clear ws ref
    wsRef.current = null;

    setIsRecording(false);
  }, []);

  return {
    finalTranscript,
    isRecording,
    start,
    stop,
  };
}
