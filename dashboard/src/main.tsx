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
import { KernelTypesProvider } from "./contexts/KernelTypesContext";
import Dashboard from "./pages/Dashboard";
import CustomDashboard from "./pages/CustomDashboard";
import History from "./pages/History";
import AddKernels from "./pages/AddKernels";
import Tuning from "./pages/Tuning";
import Runs from "./pages/Runs";
import Tracking from "./pages/Tracking";
import KernelTrace from "./pages/KernelTrace";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <AuthProvider>
        <KernelTypesProvider>
          <Routes>
          <Route path="/trace/:runId" element={<KernelTrace />} />
          <Route path="/dashboard/config/:slug" element={<CustomDashboard />} />
          <Route path="/dashboard/tracker/:dashboardName" element={<Dashboard />} />
          <Route path="/dashboard/:runId" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/new" element={<AddKernels />} />
          <Route path="/kernels" element={<Tuning />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route
            path="*"
            element={<Navigate to="/dashboard/baseline" replace />}
          />
        </Routes>
        </KernelTypesProvider>
      </AuthProvider>
    </Router>
  </StrictMode>
);
