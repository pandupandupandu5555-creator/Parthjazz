export const FEATURES = {
  memory:
    process.env.FEATURE_MEMORY !== "false",

  analytics:
    process.env.FEATURE_ANALYTICS === "true",

  webSearch:
    process.env.FEATURE_WEB_SEARCH === "true",

  fallback:
    process.env.FEATURE_FALLBACK !== "false",
};