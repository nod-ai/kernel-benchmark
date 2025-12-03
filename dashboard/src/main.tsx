import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import AddKernels from "./pages/AddKernels";
import Tuning from "./pages/Tuning";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/dashboard/:runId" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/new" element={<AddKernels />} />
          <Route path="/tune" element={<Tuning />} />
          <Route
            path="*"
            element={<Navigate to="/dashboard/baseline" replace />}
          />
        </Routes>
      </AuthProvider>
    </Router>
  </StrictMode>
);
