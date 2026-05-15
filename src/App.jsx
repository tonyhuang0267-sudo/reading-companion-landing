import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./LandingPage.jsx";
import PasswordGate from "./app/PasswordGate.jsx";
import ReadingApp from "./app/ReadingApp.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={
          <PasswordGate>
            {(onLogout, username) => <ReadingApp onLogout={onLogout} username={username} />}
          </PasswordGate>
        } />
      </Routes>
    </BrowserRouter>
  );
}
