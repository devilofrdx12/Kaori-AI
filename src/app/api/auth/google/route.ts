import { NextRequest, NextResponse } from "next/server";
import {
  createOAuthState,
  getOAuthStateCookieName,
  getSessionUser,
} from "../../lib/auth-utils";
import { buildTrustedAppUrl } from "../../lib/app-origin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");
  const user = await getSessionUser();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(
      buildTrustedAppUrl("/login?error=google_not_configured", req)
    );
  }

  // Standard OpenID Connect scopes (avoids Google restricted scopes block and verification requirements)
  const scope = "openid email profile";
  
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("access_type", "offline");
  authUrl.searchParams.append("prompt", "select_account");

  // If user is already logged in and not explicitly requesting login mode, link to their account.
  // Otherwise, run in "login" mode for authentication / sign-up.
  const stateTarget = user && mode !== "login" ? user.id : "login";
  const oauthState = createOAuthState("google", stateTarget);
  authUrl.searchParams.append("state", oauthState.state);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(getOAuthStateCookieName("google"), oauthState.cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  return response;
}
