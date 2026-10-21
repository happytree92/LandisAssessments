import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Access decisions must use getSession (lib/session.ts), which re-checks the
// user in the database. verifyToken alone trusts an 8-hour token after the user
// has been deactivated or demoted. Logout reads the token only to log who left.
const ALLOWED = new Set(["lib/auth.ts", "lib/session.ts", "app/api/auth/logout/route.ts"]);

const root = path.resolve(__dirname, "..");

function sourceFiles(): string[] {
  const files = ["proxy.ts"];
  for (const dir of ["app", "components", "lib"]) {
    for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true }) as string[]) {
      const file = path.posix.join(dir, entry.split(path.sep).join("/"));
      if (/\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file)) files.push(file);
    }
  }
  return files;
}

describe("session checks", () => {
  it("only lib/session.ts and the logout route use verifyToken", () => {
    const offenders = sourceFiles().filter(
      (file) => !ALLOWED.has(file) && /\bverifyToken\b/.test(fs.readFileSync(path.join(root, file), "utf8"))
    );

    expect(offenders, "use getSession from @/lib/session instead").toEqual([]);
  });
});
