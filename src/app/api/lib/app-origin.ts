function validateConfiguredOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    !url.hostname
  ) {
    throw new Error("NEXT_PUBLIC_BASE_URL must be an absolute http(s) origin without credentials");
  }

  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_BASE_URL must use https in production");
  }

  return url.origin;
}

/**
 * Uses a deployment-controlled origin for URLs that carry authenticated state.
 * A request Host header is allowed only during local development, where it is
 * convenient for localhost previews but must not define production targets.
 */
export function getTrustedAppOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (configured) return validateConfiguredOrigin(configured);

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_BASE_URL is required in production");
  }

  return validateConfiguredOrigin(new URL(request.url).origin);
}

export function buildTrustedAppUrl(pathname: string, request: Request): URL {
  return new URL(pathname, getTrustedAppOrigin(request));
}
