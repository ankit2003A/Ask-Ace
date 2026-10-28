import { useCallback, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { getToken, setToken } from "./api";
import AuthForm from "./components/AuthForm.jsx";
import SiteNav from "./components/SiteNav.jsx";
import Hub from "./pages/Hub.jsx";
import Exams from "./pages/Exams.jsx";
import Workspace from "./components/Workspace.jsx";

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setAuthed(false);
  }, []);

  const login = useCallback((token) => {
    setToken(token);
    setAuthed(true);
  }, []);

  /* Renders the sign-in form in place instead of redirecting, so the URL —
     and with it any ?doc= handoff — survives logging in. */
  const guarded = (element) => (authed ? element : <AuthForm onSuccess={login} />);

  return (
    <>
      <div className="glow-field" aria-hidden="true" />
      <SiteNav authed={authed} onLogout={logout} />
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/documents" element={guarded(<Workspace onLogout={logout} />)} />
        <Route path="/exams" element={guarded(<Exams onLogout={logout} />)} />
        <Route path="*" element={<Hub />} />
      </Routes>
    </>
  );
}
