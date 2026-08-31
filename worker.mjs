// Static SPA entrypoint kept in the project root so Wrangler can deploy the
// asset bundle without generating or bundling an internal placeholder worker.
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    const pathname = new URL(request.url).pathname;
    const contentType = headers.get("content-type") ?? "";

    // HTML is the SPA shell and must see each release promptly. Vite emits
    // fingerprinted assets, so those can be immutable; original art/video
    // keeps a modest cache window because filenames intentionally stay human
    // readable for the content catalog.
    if (contentType.includes("text/html")) {
      headers.set("Cache-Control", "no-cache");
    } else if (pathname.startsWith("/assets/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (/\.(?:png|webm|svg|webmanifest)$/i.test(pathname)) {
      headers.set("Cache-Control", "public, max-age=604800");
    }

    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
