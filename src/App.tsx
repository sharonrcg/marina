import "./App.css";
import { Auth, FamilyJoin, Home } from "./pages";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./context";
import { FamilyCreate, Logout, Welcome, Settings } from "./pages";
import { NavDrawer } from "./components";

// todo - move nav code to its own component
function App() {
  const { user } = useContext(AuthContext);

  return (
    <BrowserRouter>
      {user && <NavDrawer user={user} />}
      <div id="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/login" element={<Auth isLoggingIn />} />
          <Route path="/family/new" element={<FamilyCreate />} />
          <Route path="/family/join" element={<FamilyJoin />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
