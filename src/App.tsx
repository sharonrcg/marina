import "./App.css";
import { Auth, FamilyJoin, Home } from "./pages";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context";
import { FamilyCreate, Logout, Welcome, Settings } from "./pages";
import { NavDrawer } from "./components";

// Requires: logged in + has family. Redirects otherwise.
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, hasFamily, authLoading } = useContext(AuthContext);
  if (authLoading) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  if (!hasFamily) return <Navigate to="/family/new" replace />;
  return <>{children}</>;
}

// Requires: logged in + no family. Redirects otherwise.
function NoFamilyRoute({ children }: { children: React.ReactNode }) {
  const { user, hasFamily, authLoading } = useContext(AuthContext);
  if (authLoading) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  if (hasFamily) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Requires: not logged in. Redirects logged-in users to the right place.
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, hasFamily, authLoading } = useContext(AuthContext);
  if (authLoading) return null;
  if (user) return <Navigate to={hasFamily ? "/" : "/family/new"} replace />;
  return <>{children}</>;
}

function App() {
  const { user } = useContext(AuthContext);

  return (
    <BrowserRouter>
      {user && <NavDrawer user={user} />}
      <div id="app">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          <Route path="/family/new" element={<NoFamilyRoute><FamilyCreate /></NoFamilyRoute>} />
          <Route path="/family/join" element={<NoFamilyRoute><FamilyJoin /></NoFamilyRoute>} />

          <Route path="/welcome" element={<PublicRoute><Welcome /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Auth isLoggingIn /></PublicRoute>} />

          <Route path="/logout" element={<Logout />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
