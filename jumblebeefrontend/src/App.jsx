//App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dictation from "./pages/dictation";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="dictation" element={Dictation} />
      </Routes>
    </BrowserRouter>
  );
}
