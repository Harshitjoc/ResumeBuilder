// Fails the production build if VITE_API_URL is missing or empty.
// Vercel (and other hosts) silently serve index.html for unknown routes, so a
// missing API URL turns every /api call into an opaque HTML error. Fail loudly.
if (process.env.NODE_ENV !== 'production') {
  process.exit(0)
}
if (!process.env.VITE_API_URL || !process.env.VITE_API_URL.trim()) {
  console.error(
    '\n[require-api-url] VITE_API_URL must be set for production builds.\n' +
      'Add it in the host dashboard (e.g. https://your-backend.railway.app) and redeploy.\n',
  )
  process.exit(1)
}