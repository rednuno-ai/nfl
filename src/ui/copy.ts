/**
 * Public-facing account copy starts from a typed English source instead of
 * scattering one-off literals through the entry flow.  New locales can add a
 * sibling key without mixing languages inside a screen.
 */
export const PUBLIC_COPY = {
  en: {
    demo: {
      title: "Playable demo",
      detail: "A fresh, resettable test profile.",
      use: "Use demo",
      opening: "Opening a fresh demo…",
    },
    storage: {
      server: "This published account and its careers are saved in GRIDIRON LIFE's Cloudflare save service. Sign in to the same account to access them on another device.",
      local: "This development or offline session saves accounts and careers only in this browser. It has no server backup or cross-device sync.",
      serverShort: "Your account and careers are saved in GRIDIRON LIFE's Cloudflare save service.",
      localShort: "Your account and careers are saved only in this browser's local storage.",
    },
  },
} as const;

/** Locale selection intentionally remains fixed until translated copy exists. */
export const publicCopy = PUBLIC_COPY.en;
