//textrender.js
import { useEffect, useMemo, useRef, useState } from "react";


function normalizeToSingleLetter(raw) {
  if (!raw) return { letter: null, reason: "empty" };

  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length === 1 && cleaned >= "a" && cleaned <= "z") {
    return { letter: cleaned, reason: "single-letter" };
  }

  const map = new Map([
    ["ay", "a"],
    ["bee", "b"],
    ["be", "b"],
    ["see", "c"],
    ["sea", "c"],
    ["dee", "d"],
    ["ee", "e"],
    ["eff", "f"],
    ["ef", "f"],
    ["gee", "g"],
    ["aitch", "h"],
    ["eye", "i"],
    ["jay", "j"],
    ["kay", "k"],
    ["el", "l"],
    ["ell", "l"],
    ["em", "m"],
    ["en", "n"],
    ["oh", "o"],
    ["owe", "o"],
    ["pee", "p"],
    ["cue", "q"],
    ["queue", "q"],
    ["are", "r"],
    ["ess", "s"],
    ["tee", "t"],
    ["you", "u"],
    ["vee", "v"],
    ["double u", "w"],
    ["double you", "w"],
    ["ex", "x"],
    ["why", "y"],
    ["zed", "z"],
    ["zee", "z"],
  ]);

  if (map.has(cleaned)) {
    return { letter: map.get(cleaned), reason: "mapped" };
  }

  return { letter: null, reason: "not-one-letter" };
}

export default function TextRender({ dictation, correctWord = "jumble" }) {
  const correctWordArray = useMemo(
    () => correctWord.toLowerCase().split(""),
    [correctWord]
  );

  const [guessedLetters, setGuessedLetters] = useState(
    Array.from({ length: correctWordArray.length }, () => "")
  );

  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState("");

  const lastProcessedTranscriptRef = useRef("");

  const { finalTranscript, isRecording, start, stop } = dictation;
  
  useEffect(() => {
    if (!finalTranscript) return;
    if (finalTranscript === lastProcessedTranscriptRef.current) return;

    lastProcessedTranscriptRef.current = finalTranscript;

    const words = finalTranscript.trim().split(/\s+/);
    const newestWord = words[words.length - 1];

    const { letter, reason } = normalizeToSingleLetter(newestWord);

    if (!letter) {
      setStatus(`Say ONE letter. Heard: "${newestWord}" (${reason})`);
      return;
    }

    setGuessedLetters((prev) => {
      const next = [...prev];

      if (cursor >= next.length) {
        setStatus("Word is already full.");
        return prev;
      }

      next[cursor] = letter;
      return next;
    });

    setCursor((c) => Math.min(c + 1, correctWordArray.length));
    setStatus(`Heard: ${letter.toUpperCase()}`);
  }, [finalTranscript, cursor, correctWordArray.length]);

  const reset = () => {
    setGuessedLetters(Array.from({ length: correctWordArray.length }, () => ""));
    setCursor(0);
    setStatus("");
    lastProcessedTranscriptRef.current = "";
  };

  const guessedString = guessedLetters
    .map((letter) => (letter ? letter.toUpperCase() : "•"))
    .join(" ");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1>JumbleBee Dictation</h1>

      <p>
        Say one letter at a time.
      </p>

      <div
        style={{
          fontSize: 32,
          letterSpacing: 8,
          border: "1px solid #ccc",
          padding: 16,
          borderRadius: 8,
          width: "fit-content",
          marginBottom: 12,
        }}
      >
        {guessedString}
      </div>

      <p>
        Cursor: {cursor} / {correctWordArray.length}
      </p>

      {status && <p>{status}</p>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={start} disabled={isRecording}>
          Start speaking
        </button>

        <button onClick={stop} disabled={!isRecording}>
          Stop
        </button>

        <button onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}