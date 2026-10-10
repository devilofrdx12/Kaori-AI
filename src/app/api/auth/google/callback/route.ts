import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuid } from "uuid";
import {
  findUserByEmail,
  createUser,
  upsertOAuthToken,
  insertRefreshToken,
} from "../../../lib/db";
import { encrypt } from "../../../lib/crypto";
import { buildTrustedAppUrl } from "../../../lib/app-origin";
import {
  getOAuthStateCookieName,
  getSessionUser,
  verifyOAuthState,
  issueAccessToken,
  issueRefreshToken,
  setAuthCookiesOnResponse,
  REFRESH_TTL,
  getClientIp,
} from "../../../lib/auth-utils";
import { logger } from "../../../lib/logger";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const stateCookie = getOAuthStateCookieName("google");

  if (error) {
    logger.warn({ error }, "Google OAuth provider returned error");
    const response = NextResponse.redirect(
      buildTrustedAppUrl("/login?error=google_auth_failed", req)
    );
    response.cookies.delete(stateCookie);
    return response;
  }

  if (!code || !state) {
    const response = NextResponse.redirect(
      buildTrustedAppUrl("/login?error=google_missing_params", req)
    );
    response.cookies.delete(stateCookie);
    return response;
  }

  const stateUserId = verifyOAuthState("google", state, req.cookies.get(stateCookie)?.value);
  if (!stateUserId) {
    logger.warn("Invalid or expired Google OAuth state");
    const response = NextResponse.redirect(
      buildTrustedAppUrl("/login?error=google_state_invalid", req)
    );
    response.cookies.delete(stateCookie);
    return response;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    const response = NextResponse.redirect(
      buildTrustedAppUrl("/login?error=google_not_configured", req)
    );
    response.cookies.delete(stateCookie);
    return response;
  }

  try {
    // Exchange authorization code for tokens
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

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      logger.error({ status: tokenRes.status }, "Google OAuth token exchange failed");
      const dest = stateUserId === "login" ? "/login?error=google_token_failed" : "/?error=google_token_failed";
      const response = NextResponse.redirect(buildTrustedAppUrl(dest, req));
      response.cookies.delete(stateCookie);
      return response;
    }

    // Fetch user profile from Google using the access token
    const userProfileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userProfileRes.ok) {
      logger.error({ status: userProfileRes.status }, "Failed to fetch Google userinfo");
      const dest = stateUserId === "login" ? "/login?error=google_profile_failed" : "/?error=google_profile_failed";
      const response = NextResponse.redirect(buildTrustedAppUrl(dest, req));
      response.cookies.delete(stateCookie);
      return response;
    }

    const profile = await userProfileRes.json();
    const email = (typeof profile.email === "string" ? profile.email : "").toLowerCase().trim();

    if (!email) {
      const dest = stateUserId === "login" ? "/login?error=google_email_missing" : "/?error=google_email_missing";
      const response = NextResponse.redirect(buildTrustedAppUrl(dest, req));
      response.cookies.delete(stateCookie);
      return response;
    }

    // --- FLOW 1: LOGIN / SIGN-UP VIA GOOGLE ---
    if (stateUserId === "login") {
      let user = await findUserByEmail(email);

      if (!user) {
        // Automatically create account for new Google user
        const randomSecret = crypto.randomBytes(32).toString("hex");
        const passwordHash = await bcrypt.hash(randomSecret, 12);
        const displayName = (profile.name || email.split("@")[0] || "User").trim().slice(0, 50);

        user = await createUser({
          id: uuid(),
          name: displayName,
          email,
          password_hash: passwordHash,
        });
        logger.info({ userId: user.id }, "Auto-created new user account via Google Sign-In");
      }

      // Persist encrypted OAuth token for the user
      await upsertOAuthToken({
        id: uuid(),
        user_id: user.id,
        provider: "google",
        access_token_enc: encrypt(tokenData.access_token),
        refresh_token_enc: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        expires_at: tokenData.expires_in ? Math.floor(Date.now() / 1000) + tokenData.expires_in : null,
        scope: tokenData.scope || null,
      });

      // Issue Kaori session tokens
      const ip = getClientIp(req);
      const accessToken = issueAccessToken(user.id, user.email);
      const { raw: refreshRaw, hash: refreshHash } = issueRefreshToken();

      await insertRefreshToken({
        id: crypto.randomUUID(),
        user_id: user.id,
        token_hash: refreshHash,
        expires_at: Math.floor(Date.now() / 1000) + REFRESH_TTL,
        user_agent: req.headers.get("user-agent") || undefined,
        ip,
      });

      logger.info({ userId: user.id }, "Google Sign-In successful");

      const response = NextResponse.redirect(buildTrustedAppUrl("/", req));
      response.cookies.delete(stateCookie);
      setAuthCookiesOnResponse(response, accessToken, refreshRaw);
      return response;
    }

    // --- FLOW 2: ACCOUNT LINKING (EXISTING LOGGED-IN USER) ---
    const sessionUser = await getSessionUser();
    if (!sessionUser || sessionUser.id !== stateUserId) {
      const response = NextResponse.redirect(buildTrustedAppUrl("/?error=google_state_invalid", req));
      response.cookies.delete(stateCookie);
      return response;
    }

    await upsertOAuthToken({
      id: uuid(),
      user_id: sessionUser.id,
      provider: "google",
      access_token_enc: encrypt(tokenData.access_token),
      refresh_token_enc: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      expires_at: tokenData.expires_in ? Math.floor(Date.now() / 1000) + tokenData.expires_in : null,
      scope: tokenData.scope || null,
    });

    const response = NextResponse.redirect(buildTrustedAppUrl("/?success=google_connected", req));
    response.cookies.delete(stateCookie);
    return response;
  } catch (err) {
    logger.error({ err }, "Google token exchange unhandled error");
    const dest = stateUserId === "login" ? "/login?error=google_internal_error" : "/?error=google_internal_error";
    const response = NextResponse.redirect(buildTrustedAppUrl(dest, req));
    response.cookies.delete(stateCookie);
    return response;
  }
}
