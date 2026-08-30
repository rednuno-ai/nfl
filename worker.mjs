// Static SPA entrypoint kept in the project root so Wrangler can deploy the
// asset bundle without generating or bundling an internal placeholder worker.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
