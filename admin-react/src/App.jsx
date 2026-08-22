import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import AppLayout from "./components/layout/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Buses from "./pages/Buses";
import Drivers from "./pages/Drivers";
import Students from "./pages/Students";
import Requests from "./pages/Requests";
import Complaints from "./pages/Complaints";
import Schedule from "./pages/Schedule";
import Routes1 from "./pages/Routes";
import LiveTracking from "./pages/LiveTracking";
import Reports from "./pages/Reports";
import "./styles/global.css";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename="/admin-dashboard">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/buses" element={<Buses />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/students" element={<Students />} />
              <Route path="/complaints" element={<Complaints />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/routes" element={<Routes1 />} />
              <Route path="/tracking" element={<LiveTracking />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
