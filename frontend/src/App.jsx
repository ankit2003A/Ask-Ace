import { useCallback, useState } from "react";
import { getToken, setToken } from "./api";
import AuthForm from "./components/AuthForm.jsx";
import Workspace from "./components/Workspace.jsx";

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setAuthed(false);
  }, []);

  if (!authed) {
    return (
      <AuthForm
        onSuccess={(token) => {
          setToken(token);
          setAuthed(true);
        }}
      />
    );
  }
  return <Workspace onLogout={logout} />;
}
