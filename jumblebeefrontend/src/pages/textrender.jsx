import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * TextRender prototype for Jumble Bee "spell the word" mechanic using STT over WebSocket.
 *
 * Assumptions from our previous Jumble Bee context:
 * - WebSocket STT messages are JSON: { type: "partial"|"final", text: "..." }
 * - There may also be JSON "command" messages; we ignore those.
 * - STT may return homophones/words for letters (e.g., "see" => C, "are" => R, "double you" => W)
 */

function normalizeToSingleLetter(raw) {
  if (!raw) return { letter: null, reason: "empty" };

  const text = String(raw).trim().toLowerCase();

  // Common cleanup
  const cleaned = text
    .replace(/[^\w\s]/g, " ") // remove punctuation
    .replace(/\s+/g, " ")
    .trim();

  // If it's literally a single alphabetic letter already
  if (cleaned.length === 1 && cleaned >= "a" && cleaned <= "z") {
    return { letter: cleaned, reason: "single-letter" };
  }

  // Some STT engines might output "a." or "a," etc. handled above via punctuation removal,
  // but if it produced something like "a " then cleaned becomes "a" and works.

  // Homophones / letter-names / spoken forms
  // (You can expand this list as you notice new STT quirks.)
  const map = new Map([
    // Single-letter names (common spoken)
    ["ay", "a"],
    ["eh", "a"],

    ["bee", "b"],
    ["be", "b"],

    ["see", "c"],
    ["sea", "c"],

    ["dee", "d"],
    ["the", "d"], // occasionally "the" is misheard for "d" in some accents

    ["ee", "e"],
    ["e", "e"],

    ["eff", "f"],
    ["ef", "f"],

    ["gee", "g"],
    ["jee", "g"],

    ["aitch", "h"],
    ["h", "h"],

    ["eye", "i"],
    ["i", "i"],

    ["jay", "j"],
    ["j", "j"],

    ["kay", "k"],
    ["k", "k"],

    ["el", "l"],
    ["ell", "l"],

    ["em", "m"],

    ["en", "n"],

    ["oh", "o"],
    ["owe", "o"],

    ["pee", "p"],
    ["pea", "p"],

    ["cue", "q"],
    ["queue", "q"],
    ["q", "q"],

    ["are", "r"],
    ["our", "r"],

    ["ess", "s"],
    ["s", "s"],

    ["tee", "t"],
    ["tea", "t"],

    ["you", "u"],
    ["yew", "u"],

    ["vee", "v"],
    ["we", "v"], // rare mishear

    ["double u", "w"],
    ["double you", "w"],
    ["w", "w"],

    ["ex", "x"],

    ["why", "y"],
    ["wy", "y"],

    ["zed", "z"],
    ["zee", "z"],

    // Sometimes STT returns NATO-ish words; add a small useful subset:
    ["alpha", "a"],
    ["bravo", "b"],
    ["charlie", "c"],
    ["delta", "d"],
    ["echo", "e"],
    ["foxtrot", "f"],
    ["golf", "g"],
    ["hotel", "h"],
    ["india", "i"],
    ["juliet", "j"],
    ["kilo", "k"],
    ["lima", "l"],
    ["mike", "m"],
    ["november", "n"],
    ["oscar", "o"],
    ["papa", "p"],
    ["quebec", "q"],
    ["romeo", "r"],
    ["sierra", "s"],
    ["tango", "t"],
    ["uniform", "u"],
    ["victor", "v"],
    ["whiskey", "w"],
    ["x-ray", "x"],
    ["xray", "x"],
    ["yankee", "y"],
    ["zulu", "z"],
  ]);

  if (map.has(cleaned)) {
    return { letter: map.get(cleaned), reason: "mapped-homophone" };
  }

  // If STT gives multiple words like "letter a" or "it's a"
  // try to extract a single letter token from the end.
  const tokens = cleaned.split(" ").filter(Boolean);

  // Look for any token that is a single letter a-z
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    if (t.length === 1 && t >= "a" && t <= "z") return { letter: t, reason: "token-single-letter" };
    if (map.has(t)) return { letter: map.get(t), reason: "token-mapped" };
  }

  return { letter: null, reason: "not-single-letter" };
}

export default function TextRender({
  wsUrl = "ws://localhost:8000/ws/stt/", // change to your Django Channels WS route
  correctWord = "jumble",
}) {
  // store correct word as array
  const correctWordArray = useMemo(() => correctWord.toLowerCase().split(""), [correctWord]);

  // store guessed letters (same length)
  const [guessedLetters, setGuessedLetters] = useState(() =>
    Array.from({ length: correctWordArray.length }, () => "")
  );

  // cursor of our position in guessed letter array
  const [cursor, setCursor] = useState(0);

  // error/status
  const [status, setStatus] = useState("");

  // evaluation lock: "word is already being evaluated, bail"
  const evaluatingRef = useRef(false);

  // websocket ref
  const wsRef = useRef(null);

  // reset (matches your "set arrays to empty / cursor to 0" but we keep length aligned to word)
  const reset = useCallback(() => {
    evaluatingRef.current = false;
    setStatus("");
    setCursor(0);
    setGuessedLetters(Array.from({ length: correctWordArray.length }, () => ""));
  }, [correctWordArray.length]);

  const handleCorrect = useCallback(() => {
    setStatus("✅ Correct!");
  }, []);

  const handleIncorrect = useCallback(() => {
    setStatus("❌ Incorrect.");
  }, []);

  // compare when full
  const maybeEvaluate = useCallback(
    (lettersArr) => {
      const isFull = lettersArr.every((ch) => ch && ch.length === 1);
      if (!isFull) return;

      // lock evaluation
      evaluatingRef.current = true;

      const guessed = lettersArr.join("");
      const correct = correctWordArray.join("");

      if (guessed === correct) handleCorrect();
      else handleIncorrect();
    },
    [correctWordArray, handleCorrect, handleIncorrect]
  );

  useEffect(() => {
    // whenever correctWord changes, reset state
    reset();
  }, [reset]);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("Connected to STT.");
      // If your backend expects a start command, uncomment:
      // ws.send(JSON.stringify({ type: "start" }));
    };

    ws.onerror = () => {
      setStatus("WebSocket error.");
    };

    ws.onclose = () => {
      setStatus((prev) => (prev ? `${prev} (disconnected)` : "Disconnected."));
    };

    ws.onmessage = (event) => {
      // If word is already being evaluated, bail
      if (evaluatingRef.current) return;

      const data = event.data;

      // If WebSocket message is a JSON command, do nothing.
      // In our Jumble Bee setup, transcripts are JSON like {type,text}.
      // We'll parse JSON and only react if it has a usable `text` string.
      let payload = null;
      if (typeof data === "string") {
        try {
          payload = JSON.parse(data);
        } catch {
          // not JSON; treat as raw text
        }
      }

      let text = "";
      if (payload && typeof payload === "object") {
        // ignore non-transcript JSON commands
        if (typeof payload.text !== "string") return;

        // optional: only accept "final" if you want to avoid partial spam
        // if (payload.type !== "final") return;

        text = payload.text;
      } else {
        // non-JSON -> extract text
        text = String(data);
      }

      const { letter, reason } = normalizeToSingleLetter(text);

      if (!letter) {
        // if text is more than one letter, display an error message.
        // (Here we also cover "not interpretable as a single letter")
        setStatus(`Say ONE letter. Heard: "${String(text).slice(0, 60)}" (${reason})`);
        return;
      }

      // write letter at cursor, increment cursor
      setGuessedLetters((prev) => {
        if (cursor >= prev.length) return prev; // safety

        const next = [...prev];
        next[cursor] = letter;

        // if now full, evaluate
        // (We evaluate with `next` right away so we don't depend on async state)
        maybeEvaluate(next);

        return next;
      });

      setCursor((c) => Math.min(c + 1, correctWordArray.length));
      setStatus(`Heard: ${letter.toUpperCase()}`);
    };

    return () => {
      // clean up
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          // If your backend expects stop:
          // ws.send(JSON.stringify({ type: "stop" }));
        }
        ws.close();
      } catch {
        // ignore
      }
    };
  }, [wsUrl, cursor, correctWordArray.length, maybeEvaluate]);

  const guessedString = guessedLetters.map((c) => (c ? c.toUpperCase() : "•")).join(" ");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h2 style={{ margin: 0 }}>Spell the word</h2>
      <p style={{ marginTop: 8, marginBottom: 8 }}>
        Word length: <b>{correctWordArray.length}</b>
      </p>

      <div
        style={{
          display: "inline-block",
          padding: "12px 14px",
          border: "1px solid #ccc",
          borderRadius: 8,
          letterSpacing: 2,
          fontSize: 24,
          marginBottom: 10,
          userSelect: "none",
        }}
      >
        {guessedString}
      </div>

      <div style={{ marginBottom: 10 }}>
        Cursor: <b>{cursor}</b> / {correctWordArray.length}
      </div>

      {status && (
        <div style={{ marginBottom: 12 }}>
          <small>{status}</small>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={reset} style={{ padding: "8px 12px" }}>
          Reset
        </button>

        <button
          onClick={() => {
            // reveal for debugging
            setStatus(`Correct word: ${correctWordArray.join("").toUpperCase()}`);
          }}
          style={{ padding: "8px 12px" }}
        >
          Reveal (debug)
        </button>

        <button
          onClick={() => {
            // allow another attempt after evaluation
            evaluatingRef.current = false;
            setStatus("Unlocked evaluation. Continue spelling.");
          }}
          style={{ padding: "8px 12px" }}
        >
          Unlock (debug)
        </button>
      </div>
    </div>
  );
}
