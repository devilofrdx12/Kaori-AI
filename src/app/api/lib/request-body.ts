export class RequestBodyError extends Error {
  constructor(message: string, readonly status: 400 | 413) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isSafeInteger(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyError("Request body is too large", 413);
  }

  if (!request.body) return {};
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("Request body exceeded the configured size limit");
        throw new RequestBodyError("Request body is too large", 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RequestBodyError("JSON body must be an object", 400);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Invalid JSON body", 400);
  }
}
