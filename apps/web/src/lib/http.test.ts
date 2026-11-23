import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, refreshSession, setAccessToken } from "./http";

const sessionPayload = {
  accessToken: "new-access-token",
  expiresIn: 900,
  user: {
    id: "user-1",
    name: "Administrator",
    email: "admin@example.com",
    status: "ACTIVE",
    roles: [],
    permissions: [],
    lastLoginAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    session: {
      id: "session-1",
      expiresAt: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("http client", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one refresh request between concurrent callers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, sessionPayload));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first?.accessToken).toBe("new-access-token");
    expect(second?.accessToken).toBe("new-access-token");
  });

  it("refreshes once after a 401 and retries the original request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "SESSION_EXPIRED", message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(200, sessionPayload))
      .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    setAccessToken("stale-token");
    const result = await apiRequest<{ total: number }>("/users");

    expect(result.total).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const retriedHeaders = (fetchMock.mock.calls[2]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(retriedHeaders.Authorization).toBe("Bearer new-access-token");
  });
});
