export type AuthUser = { id: string; name: string; email: string };

// ── CSRF header on all API calls ──
const AJAX_HEADERS: HeadersInit = {
  "X-Requested-With": "XMLHttpRequest",
};

async function jsonOrThrow(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

export async function me(): Promise<AuthUser | null> {
  try {
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      headers: AJAX_HEADERS,
    });

    if (res.status === 401) {
      // Try silent refresh
      const refreshRes = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (refreshRes.ok) {
        // Retry /me
        const retryRes = await fetch("/api/auth/me", {
          credentials: "include",
          headers: AJAX_HEADERS,
        });
        if (retryRes.ok) return await retryRes.json();
      }
      return null;
    }

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return jsonOrThrow(res);
}

export async function signup(
  name: string,
  email: string,
  password: string
): Promise<AuthUser> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    credentials: "include",
    headers: { ...AJAX_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return jsonOrThrow(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: AJAX_HEADERS,
  });
}
