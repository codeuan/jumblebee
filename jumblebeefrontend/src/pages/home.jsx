//home.jsx
import { useState } from "react";
import TextRender from "./TextRender";

const IS_ADMIN = true; //toggle administrator mode.

const QUESTIONS = [
  { id: 1, word: "fuchsia" },
  { id: 2, word: "rhythm" },
  { id: 3, word: "queue" },
  { id: 4, word: "banana" },
  { id: 5, word: "acquiesce" },
]; //questions and their respective IDs.

function pickRandomQuestion() {
  const index = Math.floor(Math.random() * QUESTIONS.length);
  return QUESTIONS[index];
} //return a random question.

export default function Home({ dictation }) {
  const [currentQuestion, setCurrentQuestion] = useState(() =>
    pickRandomQuestion()
  ); //lazy evaluation.

  function nextQuestion() {
    setCurrentQuestion(pickRandomQuestion());
  }

  return (
    <div style={{ padding: 16 }}>
      {IS_ADMIN ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid orange",
            background: "#fff7e6",
          }} 
          <p>Correct word: {currentQuestion.word}</p>
          <p>Question ID: {currentQuestion.id}</p>
        </div>
      ): null} //show correct word and its ID for administrative purposes.

      <TextRender
        dictation={dictation}
        correctWord={currentQuestion.word}
        isAdmin={IS_ADMIN}
      />
    </div>
  );
}
