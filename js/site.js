// Per-host settings: the flasher is served on GitHub Pages
const searchParams = new URLSearchParams(location.search);

export const logoFile = "mishmesh.svg";

// ?config=name loads /name.json instead of the default catalog
export const configName =
  (searchParams.get("config") ?? "").replaceAll(/[^a-z_-]/g, "") || "config";

export const isIframe = Boolean(searchParams.get("iframe"));
