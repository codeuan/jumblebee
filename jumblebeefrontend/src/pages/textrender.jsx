//textrender.js
import { useEffect, useMemo, useRef, useState } from "react";


function normalizeToSingleLetter(raw) {
  if (!raw) return { letter: null, reason: "empty" }; //if no letter given, return null.

  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim(); //remove spaces from start and end, change to lower case, replace punctuation with spaces.

  if (cleaned.length === 1 && cleaned >= "a" && cleaned <= "z") {
    return { letter: cleaned, reason: "single-letter" };
  } //if character is a single letter, accept it as such. note: reason in this scenario doesn't actually have a practical use but is included for consistency,

  const map = new Map([
    ["ay", "a"],
    ["bee", "b"],
    ["be", "b"],
    ["see", "c"],
    ["sea", "c"],
    ["dee", "d"],
    ["the", "d"],
    ["ee", "e"],
    ["he", "e"],
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
    ["am", "m"],
    ["en", "n"],
    ["an", "n"],
    ["and", "n"],
    ["oh", "o"],
    ["owe", "o"],
    ["pee", "p"],
    ["cue", "q"],
    ["queue", "q"],
    ["huh", "q"],
    ["are", "r"],
    ["ah", "r"],
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
    ["lambda", "λ"]
  ]); //table of misheard words corresponding to letters.

  if (map.has(cleaned)) {
    return { letter: map.get(cleaned), reason: "mapped" };
  } //if the word was in the misheard letter table, return that.

  return { letter: null, reason: "not-one-letter" };
} //if more than one letter was spoken (e.g. a full word), return an error.

export default function TextRender({ dictation, correctWord = "fuchsia" }) {
  const correctWordArray = useMemo(
    () => correctWord.toLowerCase().split(""),
    [correctWord]
  ); //split correct word into letters.

  const [guessedLetters, setGuessedLetters] = useState(
    Array.from({ length: correctWordArray.length }, () => "")
  ); //make an empty array the same length as the correct word.

  const [cursor, setCursor] = useState(0); //current index in the array being filled.
  const [status, setStatus] = useState(""); //message shown to user.

  const lastProcessedTranscriptRef = useRef(""); //store the last spoken word to avoid double processing.

  const { finalTranscript, isRecording, start, stop } = dictation; 

  useEffect(() => {
  setGuessedLetters(Array.from({ length: correctWordArray.length }, () => ""));
  setCursor(0);
  setStatus("");
  lastProcessedTranscriptRef.current = finalTranscript;
}, [correctWordArray.length]); //if correct word changes, update correctWordArray.

  useEffect(() => {
    if (!finalTranscript) return; //if there is no speech, stop.
    if (finalTranscript === lastProcessedTranscriptRef.current) return; //if this transcript has already been handled, stop.

    lastProcessedTranscriptRef.current = finalTranscript; //mark transcript as handled.

    const words = finalTranscript.trim().split(/\s+/); //remove spaces and split into words.
    const newestWord = words[words.length - 1]; //retrieve the latest word.

    const { letter, reason } = normalizeToSingleLetter(newestWord); //try to convert word into its letter equivalent.

    if (!letter) {
      setStatus(`Say ONE letter. Heard: "${newestWord}" (${reason})`);
      return;
    } //if word cannot be mapped to a letter, return an error.

    setGuessedLetters((prev) => {
      const next = [...prev];

      if (cursor >= next.length) {
        setStatus("Word is already full.");
        return prev;
      } //if the word is full, stop.

      next[cursor] = letter; //put letter into empty position.
      return next; //return updated array.
    });

    setCursor((c) => Math.min(c + 1, correctWordArray.length)); //increment cursor.
    setStatus(`Heard: ${letter.toUpperCase()}`); //return what was heard.
  }, [finalTranscript, cursor, correctWordArray.length]); //run when either finalTranscript, cursor, or correctWordArray change.

  const reset = () => {
    setGuessedLetters(Array.from({ length: correctWordArray.length }, () => ""));
    setCursor(0);
    setStatus("");
    lastProcessedTranscriptRef.current = finalTranscript;
  }; 

  const undo = () => {
  setGuessedLetters((prev) => {
    const next = [...prev];

    // Move left from the current cursor position.
    const indexToRemove = cursor - 1;

    // If cursor is already at the start, there is nothing to undo.
    if (indexToRemove < 0) {
      setStatus("There are no letters.");
      return prev;
    }

    // Remove the most recent letter by replacing it with an empty string.
    next[indexToRemove] = "";

    return next; //need to return a new array so React knows to update the old one with it.
  });

  // Move the cursor one step back, but do not let it go below 0.
  setCursor((c) => Math.max(c - 1, 0));

  setStatus("Undid last letter.");
};

const audioRef = useRef(null);

const playAudio = () => {
  if (!audioRef.current) return;

  audioRef.current.currentTime = 0;
  audioRef.current.play();
};



const guessedString = guessedLetters.map((letter) => (letter ? letter.toUpperCase() : "•")).join(" ");

 return (
  <>
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1>JumbleBee Dictation</h1>

      <p>Say one letter at a time.</p>

      <button
        onClick={playAudio}
        aria-label="Play word audio"
        style={{
          fontSize: 24,
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: "8px 12px",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        🔊
      </button>
      <audio ref={audioRef} src="/audio/fuchsia.m4a" preload="auto" />
    </div>
    {IS_ADMIN ? (
  <p style={{ color: "red", fontWeight: "bold" }}>Warning: administrator mode is enabled.</p>
) : null}
    
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

        <button onClick={reset}>Reset</button>

        <button onClick={undo}>Undo</button>
      </div>
  </>
);
}
