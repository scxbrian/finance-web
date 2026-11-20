import { api } from "./client.js";

// null means "not signed in" (or the server could not be reached; the status pill says which).
export async function fetchSession() {
  try {
    const { user } = await api.get("/auth/me");
    return user;
  } catch {
    return null;
  }
}

export const signIn = (email, password) => api.post("/auth/login", { email, password }).then((r) => r.user);

export const signOut = () => api.post("/auth/logout");