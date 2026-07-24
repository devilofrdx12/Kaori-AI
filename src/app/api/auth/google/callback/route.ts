import { NextRequest, NextResponse } from "next/server";
import { upsertOAuthToken } from "../../../lib/db";
import { encrypt } from "../../../lib/crypto";
import { buildTrustedAppUrl } from "../../../lib/app-origin";
import { v4 as uuid } from "uuid";
import {
  getOAuthStateCookieName,
  getSessionUser,
  verifyOAuthState,
} from "../../../lib/auth-utils";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const stateCookie = getOAuthStateCookieName("google");

  if (error) {
    return NextResponse.redirect(buildTrustedAppUrl("/?error=google_auth_failed", req));
  }

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const stateUserId = verifyOAuthState("google", state, req.cookies.get(stateCookie)?.value);
  const user = await getSessionUser();
  if (!stateUserId || !user || user.id !== stateUserId) {
    const response = NextResponse.redirect(buildTrustedAppUrl("/?error=google_state_invalid", req));
    response.cookies.delete(stateCookie);
    return response;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Google OAuth token exchange failed", { status: tokenRes.status });
      const response = NextResponse.redirect(buildTrustedAppUrl("/?error=google_token_failed", req));
      response.cookies.delete(stateCookie);
      return response;
    }

    await upsertOAuthToken({
      id: uuid(),
      user_id: user.id,
      provider: "google",
      access_token_enc: encrypt(data.access_token),
      refresh_token_enc: data.refresh_token ? encrypt(data.refresh_token) : null,
      expires_at: data.expires_in ? Math.floor(Date.now() / 1000) + data.expires_in : null,
      scope: data.scope || null,
    });

    const response = NextResponse.redirect(buildTrustedAppUrl("/?success=google_connected", req));
    response.cookies.delete(stateCookie);
    return response;
  } catch (err) {
    console.error("Google token exchange failed:", err);
    const response = NextResponse.redirect(buildTrustedAppUrl("/?error=google_internal_error", req));
    response.cookies.delete(stateCookie);
    return response;
  }
}
