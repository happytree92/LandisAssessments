/**
 * Next.js instrumentation hook — runs once at server startup before any requests.
 * Used to validate required environment variables so misconfiguration fails fast
 * with a clear message rather than silently at request time.
 */
export async function register() {
  // Only run on the Node.js runtime (not in Edge or build-time analysis)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const baseUrl = process.env.BASE_URL?.trim();

  if (!baseUrl) {
    const banner = `
╔══════════════════════════════════════════════════════════════════════╗
║  FATAL — BASE_URL environment variable is required                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  The app cannot start without BASE_URL.                              ║
║  Set it to the public-facing HTTPS URL of this server.               ║
║                                                                      ║
║  Required for:                                                       ║
║    • SSO redirect URIs (OIDC callback)                               ║
║    • Shareable customer assessment link generation                   ║
╠══════════════════════════════════════════════════════════════════════╣
║  Add BASE_URL to your .env file:                                     ║
║                                                                      ║
║    BASE_URL=https://assessments.yourcompany.com                      ║
║                                                                      ║
║  docker-compose.yml reference:                                       ║
║                                                                      ║
║    services:                                                         ║
║      app:                                                            ║
║        environment:                                                  ║
║          - NODE_ENV=production                                       ║
║          - JWT_SECRET=<your-random-secret-min-32-chars>              ║
║          - DATABASE_URL=./data/assessments.db                        ║
║          - BASE_URL=https://assessments.yourcompany.com              ║
║        volumes:                                                      ║
║          - ./data:/app/data                                          ║
╚══════════════════════════════════════════════════════════════════════╝
`;
    console.error(banner);
    throw new Error(
      "BASE_URL env var is required but not set. See the startup log above for instructions."
    );
  }

  // In production, reject localhost/loopback/internal addresses — these are
  // never reachable from an identity provider or a customer's browser.
  if (process.env.NODE_ENV === "production") {
    const isLocal =
      /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1)(:\d+)?(\/|$)/i.test(
        baseUrl
      );
    if (isLocal) {
      const banner = `
╔══════════════════════════════════════════════════════════════════════╗
║  FATAL — BASE_URL is set to a localhost / internal address           ║
╠══════════════════════════════════════════════════════════════════════╣
║  Current value: ${baseUrl.substring(0, 52).padEnd(52)} ║
║                                                                      ║
║  In production, BASE_URL must be a public HTTPS domain that your     ║
║  identity provider and customers can reach.                          ║
║                                                                      ║
║  Example:                                                            ║
║    BASE_URL=https://assessments.yourcompany.com                      ║
╚══════════════════════════════════════════════════════════════════════╝
`;
      console.error(banner);
      throw new Error(
        "BASE_URL must be a public HTTPS URL in production, not a localhost address. See the startup log above."
      );
    }
  }

  console.log(`[startup] BASE_URL = ${baseUrl}`);
}
