import { Routes, Route } from "react-router-dom";
import Welcome from "./views/Welcome";
import Companion from "./views/Companion";
import Participant from "./views/Participant";
import MCDashboard from "./views/MCDashboard";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/companion" element={<Companion />} />
      <Route path="/participant" element={<Participant />} />
      <Route path="/mc" element={<MCDashboard />} />
    </Routes>
  );
}

export default App;
