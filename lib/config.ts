/**
 * App-wide configuration derived from environment variables.
 * Call these functions at request time — they throw with a clear message
 * if a required variable is not set, giving an immediate startup-like error
 * on the first request.
 */

export function getBaseUrl(): string {
  const url = process.env.BASE_URL;
  if (!url) {
    throw new Error(
      "BASE_URL env var is required but not set.\n" +
        "Set it to the public-facing URL of this app (e.g. https://assessments.example.com).\n" +
        "See docker-compose.yml — add: BASE_URL=https://your-domain.com"
    );
  }
  return url.replace(/\/$/, "");
}
