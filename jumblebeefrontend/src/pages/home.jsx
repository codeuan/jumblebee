import { useCallback, useEffect, useRef, useState } from "react";

export default function JumbleBeeGame() {
  const [questionId, setQuestionId] = useState(null);
  const [correctWord, setCorrectWord] = useState("");
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [status, setStatus] = useState("");

  const audioRef = useRef(null);

  // Clean up blob URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const getNextQuestion = async () => {
    // Prototype: server returns the word (later you’ll want server-side evaluation)
    const res = await fetch("/api/questions/next", { credentials: "include" });
    if (!res.ok) throw new Error(`Failed next question: ${res.status}`);
    return await res.json(); // { id, word, audio_path? }
  };

  const fetchQuestionAudioBlobUrl = async (qid) => {
    // Example endpoint: GET /api/questions/:id/audio
    const res = await fetch(`/api/questions/${qid}/audio`, {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed audio fetch: ${res.status}`);

    const blob = await res.blob();
    return URL.createObjectURL(blob);
  };

  const playAudio = async () => {
    const el = audioRef.current;
    if (!el) return;

    try {
      // iOS/Safari often requires this to be called from a user gesture (button click).
      await el.play();
    } catch (e) {
      // Don’t crash the flow if autoplay is blocked.
      setStatus("Audio ready (tap Replay to play).");
    }
  };

  const questionRetrieval = useCallback(async () => {
    try {
      setStatus("Loading next question...");
      // 1) Get next question
      const q = await getNextQuestion();

      // 2) Extract word; set guessedLetters length to word length
      const word = (q.word ?? "").toString();
      setQuestionId(q.id);
      setCorrectWord(word);
      setGuessedLetters(Array.from({ length: word.length }, () => "_"));

      // 3) Authenticated fetch for audio
      // Revoke old blob URL before replacing
      setAudioUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return old;
      });
      const blobUrl = await fetchQuestionAudioBlobUrl(q.id);
      setAudioUrl(blobUrl);

      // 4) Autoplay once loaded
      // Wait a tick so <audio src> updates before play()
      setTimeout(() => {
        playAudio();
      }, 0);

      setStatus("Question loaded.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load question.");
    }
  }, []);

  const buildGuessedWord = () => guessedLetters.join("");

  const evaluateWord = async () => {
    // 5) When word is evaluated, compare correct vs guessed
    const guess = buildGuessedWord().replaceAll("_", "");
    const correct = correctWord;

    // Simple normalization for prototype
    const norm = (s) => s.trim().toLowerCase();

    if (guess.length !== correct.length) {
      setStatus("Not complete yet.");
      return;
    }

    if (norm(guess) === norm(correct)) {
      setStatus("Correct ✅");

      // Optional: tell server you got it right
      // await fetch(`/api/questions/${questionId}/submit`, {
      //   method: "POST",
      //   credentials: "include",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ guess }),
      // });

      // Pull next question
      // await questionRetrieval();
    } else {
      setStatus("Not quite — try again.");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {/* IMPORTANT: call questionRetrieval from a click = user gesture,
            which helps autoplay work on iOS/Safari. */}
        <button onClick={questionRetrieval}>Next question</button>

        <button onClick={playAudio} disabled={!audioUrl}>
          Replay audio
        </button>

        <button onClick={evaluateWord} disabled={!correctWord}>
          Evaluate
        </button>
      </div>

      <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" />

      <div style={{ marginBottom: 8 }}>Status: {status}</div>

      <div style={{ fontFamily: "monospace", fontSize: 24 }}>
        {guessedLetters.join(" ")}
      </div>

      {/* Example “type letter into slot” stub:
          Replace with your real input logic (keyboard, buttons, STT, etc.) */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => {
            // Demo: fill the next "_" with "a"
            setGuessedLetters((prev) => {
              const i = prev.indexOf("_");
              if (i === -1) return prev;
              const next = [...prev];
              next[i] = "a";
              return next;
            });
          }}
          disabled={!correctWord}
        >
          Fill next slot with "a" (demo)
        </button>
      </div>
    </div>
  );
}
