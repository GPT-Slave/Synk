# Synk security baseline

Synk uses signed double-submit CSRF tokens on every state-changing HTTP route,
SameSite cookies, strict CORS origins, a global 30-request/minute IP limit, and
stricter authentication limits. Production rejects weak JWT/CSRF secrets and
insecure HTTP requests. The API uses Helmet with CSP/HSTS, while Next.js emits
matching browser security headers.

All user-facing text is normalized as plain text and rendered through React's
escaping. The repository intentionally contains no `dangerouslySetInnerHTML`
or dynamic code-execution sink. All database access goes through Prisma's typed
query API; raw SQL calls are prohibited by `pnpm security:audit`.

Only `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` may enter the client bundle.
Real `.env` files, private keys, and certificate containers are gitignored and
rejected by the audit if tracked.

For production:

- Use unique JWT and CSRF secrets of at least 32 characters.
- Set `CORS_ORIGIN` to the exact web origin(s), separated by commas.
- Production always enforces HTTPS; terminate TLS either in the app or proxy.
- Set `TRUST_PROXY=true` only behind a trusted single-hop reverse proxy.
- Replace the in-memory rate-limit store with a shared store before running
  more than one API replica.
