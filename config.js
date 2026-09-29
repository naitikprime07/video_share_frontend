// Frontend config — the only file that knows where the backend lives.
// Loaded with a plain <script> tag before anything else runs, so no build step is needed.
// Same origin (a reverse proxy forwards /api and /media): leave API empty.
// Separate origin (local dev, or FE on Netlify/CF Pages + BE on a Node host): set the full URL, and
// add this site's origin to the backend's ALLOWED_ORIGINS.
// For local dev these values are overridden by API_BASE_URL / PLAY_STORE_URL in the .env file (see serve.mjs).
window.APP_CONFIG = {
  API: 'https://lcxwsdx2-3000.inc1.devtunnels.ms/',
  // Fallback Google Play link for "Get the App" buttons when the API has no playStoreUrl yet.
  PLAY_STORE: 'https://play.google.com/store',
  // Sent as X-Api-Key on the upload-start call (POST /uploads). Empty here on purpose — set in .env (dev) or the host's env.
  API_KEY: '',
};

// Always a string with no trailing slash, so callers can just append "/api/…".
window.API_BASE = String(window.APP_CONFIG.API || '').replace(/\/$/, '');
window.PLAY_STORE_URL = String(window.APP_CONFIG.PLAY_STORE || '');
window.API_KEY = String(window.APP_CONFIG.API_KEY || '');
