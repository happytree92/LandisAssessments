import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

// Every .ts/.tsx file the app runs: root files (proxy.ts, instrumentation.ts and
// any added later) plus app/, components/ and lib/. Tests and config are skipped.
function sourceFiles(): string[] {
  const files = fs
    .readdirSync(root)
    .filter((file) => /\.tsx?$/.test(file) && !/\.(test|config|d)\.tsx?$/.test(file));
  for (const dir of ["app", "components", "lib"]) {
    for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true }) as string[]) {
      const file = path.posix.join(dir, entry.split(path.sep).join("/"));
      if (/\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)) files.push(file);
    }
  }
  return files;
}

function filesUsing(pattern: RegExp, allowed: Set<string>): string[] {
  return sourceFiles().filter(
    (file) => !allowed.has(file) && pattern.test(fs.readFileSync(path.join(root, file), "utf8"))
  );
}

describe("session checks", () => {
  // Access decisions must use getSession (lib/session.ts), which re-checks the
  // user in the database. verifyToken alone trusts an 8-hour token after the user
  // has been deactivated or demoted. Logout reads the token only to log who left.
  it("only lib/session.ts and the logout route use verifyToken", () => {
    const allowed = new Set(["lib/auth.ts", "lib/session.ts", "app/api/auth/logout/route.ts"]);

    expect(filesUsing(/\bverifyToken\b/, allowed), "use getSession from @/lib/session instead").toEqual([]);
  });

  // jose's jwtVerify accepts any token signed with JWT_SECRET unless it is given
  // an audience, which is how the MFA pre-auth token once passed as a session.
  // lib/auth.ts holds the verifiers that pass one; lib/sso.ts checks the IdP's token.
  it("only lib/auth.ts and lib/sso.ts call jwtVerify", () => {
    const allowed = new Set(["lib/auth.ts", "lib/sso.ts"]);

    expect(filesUsing(/\bjwtVerify\b/, allowed), "add a verifier with its own audience to lib/auth.ts").toEqual([]);
  });
});
