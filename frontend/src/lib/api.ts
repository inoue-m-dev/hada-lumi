import { getFirebaseAuth } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function postAuthVerify(idToken: string): Promise<Response> {
  return fetch(`${API_BASE_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: idToken }),
  });
}
