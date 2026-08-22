import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("admin_token");
    const stored = sessionStorage.getItem("admin_user");
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.user.role !== "admin") {
      throw { status: 403, message: "Access restricted to administrators" };
    }

    sessionStorage.setItem("admin_token", data.token);
    sessionStorage.setItem("admin_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  }

  function logout() {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
