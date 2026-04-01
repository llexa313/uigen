import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("jose", () => ({
  SignJWT: class {
    setProtectedHeader() { return this; }
    setExpirationTime() { return this; }
    setIssuedAt() { return this; }
    sign() { return Promise.resolve("mock-token"); }
  },
  jwtVerify: vi.fn(),
}));

import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createSession, getSession, deleteSession, verifySession } from "../auth";

const mockPayload = {
  userId: "user-123",
  email: "test@example.com",
  expiresAt: new Date(),
};

function makeCookieStore() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("calls cookies().set once", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    await createSession("user-123", "test@example.com");

    expect(store.set).toHaveBeenCalledOnce();
  });

  test("sets cookie with name auth-token and the signed token value", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    await createSession("user-123", "test@example.com");

    const [cookieName, cookieValue] = store.set.mock.calls[0];
    expect(cookieName).toBe("auth-token");
    expect(cookieValue).toBe("mock-token");
  });

  test("sets httpOnly and sameSite lax", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    await createSession("user-123", "test@example.com");

    const options = store.set.mock.calls[0][2];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
  });

  test("sets secure to false outside production", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    await createSession("user-123", "test@example.com");

    const options = store.set.mock.calls[0][2];
    expect(options.secure).toBe(false);
  });

  test("sets path to /", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    await createSession("user-123", "test@example.com");

    const options = store.set.mock.calls[0][2];
    expect(options.path).toBe("/");
  });

  test("cookie expires approximately 7 days from now", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const { expires } = store.set.mock.calls[0][2];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

describe("getSession", () => {
  test("returns session payload when token is valid", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue({ value: "valid-token" });
    vi.mocked(cookies).mockResolvedValue(store as any);
    vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

    const session = await getSession();

    expect(session).toEqual(mockPayload);
  });

  test("returns null when no cookie is present", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue(undefined);
    vi.mocked(cookies).mockResolvedValue(store as any);

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns null when token verification fails", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue({ value: "invalid-token" });
    vi.mocked(cookies).mockResolvedValue(store as any);
    vi.mocked(jwtVerify).mockRejectedValue(new Error("invalid signature"));

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("looks up the cookie by name 'auth-token'", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue(undefined);
    vi.mocked(cookies).mockResolvedValue(store as any);

    await getSession();

    expect(store.get).toHaveBeenCalledWith("auth-token");
  });

  test("returns null when cookie value is an empty string", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue({ value: "" });
    vi.mocked(cookies).mockResolvedValue(store as any);

    const session = await getSession();

    expect(session).toBeNull();
  });

  test("returns all payload fields", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue({ value: "valid-token" });
    vi.mocked(cookies).mockResolvedValue(store as any);
    vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

    const session = await getSession();

    expect(session?.userId).toBe(mockPayload.userId);
    expect(session?.email).toBe(mockPayload.email);
    expect(session?.expiresAt).toEqual(mockPayload.expiresAt);
  });

  test("returns null when token is expired", async () => {
    const store = makeCookieStore();
    store.get.mockReturnValue({ value: "expired-token" });
    vi.mocked(cookies).mockResolvedValue(store as any);
    vi.mocked(jwtVerify).mockRejectedValue(new Error("\"exp\" claim timestamp check failed"));

    const session = await getSession();

    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    const store = makeCookieStore();
    vi.mocked(cookies).mockResolvedValue(store as any);

    await deleteSession();

    expect(store.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  function makeRequest(token?: string) {
    return {
      cookies: {
        get: vi.fn((_name: string) => (token ? { value: token } : undefined)),
      },
    } as any;
  }

  test("returns session payload when token is valid", async () => {
    vi.mocked(jwtVerify).mockResolvedValue({ payload: mockPayload } as any);

    const session = await verifySession(makeRequest("valid-token"));

    expect(session).toEqual(mockPayload);
  });

  test("returns null when no token in request cookies", async () => {
    const session = await verifySession(makeRequest());

    expect(session).toBeNull();
  });

  test("returns null when token verification fails", async () => {
    vi.mocked(jwtVerify).mockRejectedValue(new Error("expired"));

    const session = await verifySession(makeRequest("expired-token"));

    expect(session).toBeNull();
  });
});
