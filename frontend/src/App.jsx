import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LandingPage from "./pages/LandingPage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentAssignmentPage from "./pages/StudentAssignmentPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import ModulesPage from "./pages/ModulesPage";
import PerformancePage from "./pages/PerformancePage";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { StudentClassroomProvider } from "./context/StudentClassroomContext";
import { TeacherClassroomProvider } from "./context/TeacherClassroomContext";

const initialAuth = {
  token: localStorage.getItem("token") || "",
  role: localStorage.getItem("role") || "",
  name: localStorage.getItem("name") || "",
};

function ProtectedRoute({ children, role, auth }) {
  if (!auth.token) return <Navigate to="/login" replace />;
  if (role && auth.role !== role) return <Navigate to={`/${auth.role}`} replace />;
  return children;
}

export default function App() {
  const [auth, setAuth] = useState(initialAuth);
  const navigate = useNavigate();

  const authActions = useMemo(
    () => ({
      login: (payload) => {
        localStorage.setItem("token", payload.access_token);
        localStorage.setItem("role", payload.role);
        localStorage.setItem("name", payload.name);
        setAuth({ token: payload.access_token, role: payload.role, name: payload.name });
      },
      logout: () => {
        localStorage.clear();
        setAuth({ token: "", role: "", name: "" });
        navigate("/");
      },
    }),
    [navigate]
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(125,211,252,0.12),transparent_28%),linear-gradient(180deg,#f8fbff,#eef5ff_45%,#f8fafc)]">
      <Navbar auth={auth} onLogout={authActions.logout} />
      {auth.token ? (
        auth.role === "student" ? (
          <StudentClassroomProvider>
            <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:flex-row">
              <Sidebar role={auth.role} />
              <main className="min-w-0 flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
                <Routes>
                  <Route path="/teacher" element={<ProtectedRoute auth={auth} role="teacher"><TeacherDashboard /></ProtectedRoute>} />
                  <Route path="/teacher/modules" element={<ProtectedRoute auth={auth} role="teacher"><ModulesPage role="teacher" /></ProtectedRoute>} />
                  <Route path="/teacher/performance" element={<ProtectedRoute auth={auth} role="teacher"><PerformancePage /></ProtectedRoute>} />
                  <Route path="/student" element={<ProtectedRoute auth={auth} role="student"><StudentDashboard /></ProtectedRoute>} />
                  <Route path="/student/assignments/:assignmentId" element={<ProtectedRoute auth={auth} role="student"><StudentAssignmentPage /></ProtectedRoute>} />
                  <Route path="/student/modules" element={<ProtectedRoute auth={auth} role="student"><ModulesPage role="student" /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to={`/${auth.role}`} replace />} />
                </Routes>
              </main>
            </div>
          </StudentClassroomProvider>
        ) : (
          <TeacherClassroomProvider>
            <div className="mx-auto flex w-full max-w-[1600px] flex-col lg:flex-row">
              <Sidebar role={auth.role} />
              <main className="min-w-0 flex-1 px-4 pb-10 pt-6 sm:px-6 lg:px-8">
                <Routes>
                  <Route path="/teacher" element={<ProtectedRoute auth={auth} role="teacher"><TeacherDashboard /></ProtectedRoute>} />
                  <Route path="/teacher/modules" element={<ProtectedRoute auth={auth} role="teacher"><ModulesPage role="teacher" /></ProtectedRoute>} />
                  <Route path="/teacher/performance" element={<ProtectedRoute auth={auth} role="teacher"><PerformancePage /></ProtectedRoute>} />
                  <Route path="/student" element={<ProtectedRoute auth={auth} role="student"><StudentDashboard /></ProtectedRoute>} />
                  <Route path="/student/assignments/:assignmentId" element={<ProtectedRoute auth={auth} role="student"><StudentAssignmentPage /></ProtectedRoute>} />
                  <Route path="/student/modules" element={<ProtectedRoute auth={auth} role="student"><ModulesPage role="student" /></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to={`/${auth.role}`} replace />} />
                </Routes>
              </main>
            </div>
          </TeacherClassroomProvider>
        )
      ) : (
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage onLogin={authActions.login} />} />
            <Route path="/register" element={<RegisterPage onLogin={authActions.login} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      )}
    </div>
  );
}
