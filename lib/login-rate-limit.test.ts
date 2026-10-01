import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  recordLoginSuccess,
} from "./login-rate-limit";

const MINUTE = 60 * 1000;
const START = new Date("2026-01-01T09:00:00Z").getTime();

// The limiter keeps its state at module level, so each test uses its own IP.
let ipCounter = 0;
const freshIp = () => `192.0.2.${++ipCounter}`;

function fail(ip: string, username: string, times: number) {
  for (let i = 0; i < times; i++) recordLoginFailure(ip, username);
}

function advance(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("login rate limit", () => {
  it("allows four failures and locks for 15 minutes on the fifth", () => {
    const ip = freshIp();

    fail(ip, "alice", 4);
    expect(checkLoginRateLimit(ip, "alice")).toEqual({ allowed: true });

    fail(ip, "alice", 1);
    expect(checkLoginRateLimit(ip, "alice")).toEqual({ allowed: false, retryAfter: 900 });
  });

  it("lifts the lockout once 15 minutes have passed", () => {
    const ip = freshIp();
    fail(ip, "alice", 5);

    advance(15 * MINUTE + 1000);

    expect(checkLoginRateLimit(ip, "alice")).toEqual({ allowed: true });
  });

  it("only counts failures inside the 15-minute window", () => {
    const ip = freshIp();
    fail(ip, "alice", 4);

    advance(15 * MINUTE + 1000);
    fail(ip, "alice", 4);
    expect(checkLoginRateLimit(ip, "alice")).toEqual({ allowed: true });

    fail(ip, "alice", 1);
    expect(checkLoginRateLimit(ip, "alice")).toMatchObject({ allowed: false });
  });

  it("clears failures after a successful login", () => {
    const ip = freshIp();
    fail(ip, "alice", 4);

    recordLoginSuccess(ip, "alice");
    fail(ip, "alice", 4);

    expect(checkLoginRateLimit(ip, "alice")).toEqual({ allowed: true });
  });

  it("matches usernames case-insensitively", () => {
    const ip = freshIp();

    fail(ip, "Alice", 5);

    expect(checkLoginRateLimit(ip, "alice")).toMatchObject({ allowed: false });
  });

  it("tracks each IP and username pair separately", () => {
    const ip = freshIp();

    fail(ip, "alice", 5);

    expect(checkLoginRateLimit(freshIp(), "alice")).toEqual({ allowed: true });
    expect(checkLoginRateLimit(ip, "bob")).toEqual({ allowed: true });
  });
});
