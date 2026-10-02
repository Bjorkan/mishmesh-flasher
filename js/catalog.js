// Device/firmware catalog: static config (config*.json) merged with GitHub releases served by /releases
import { configName } from "./site.js";
import { fetchJson } from "./util.js";

// Display order and headings of firmware groups on the "choose role" screen
export const firmwareClasses = {
  community: {
    title: "Community Firmware",
    tooltip:
      'Open Source <a class="inverse-link" target="_blank" href="https://burakcan.github.io/MeshCore-mishmesh/">Community firmware</a>',
  },
};

// A firmware entry names its release source with a "github*" key, e.g. "github-zephcore": { type, files }
const releaseSourceKey = (firmware) =>
  Object.keys(firmware).find((key) => key.startsWith("github"));

// Builds firmware.version from releases: { [version]: { notes, files: [{ type, name, title }] } }
// `source.files` maps file type (flash, flash-wipe, flash-update, download) to a filename regex.
function matchReleaseFiles(releases, source, sourceKey) {
  const patterns = Object.entries(source.files).map(([type, re]) => [
    type,
    new RegExp(re),
  ]);
  const versions = {};

  for (const [type, re] of patterns) {
    for (const release of releases) {
      if (release.type !== source.type) continue;
      const version = (versions[release.version] ??= {
        notes: release.notes,
        files: [],
      });

      for (const file of release.files) {
        if (!re.test(file.name)) continue;
        const url = file.url.startsWith("http")
          ? file.url
          : `${file.url}?repo=${sourceKey}`;
        version.files.push({ type, name: url, title: file.name });
      }
    }
  }

  for (const [name, version] of Object.entries(versions)) {
    if (version.files.length === 0) delete versions[name];
  }

  return versions;
}

export const hasVersions = (firmware) =>
  Object.values(firmware.version ?? {}).some((v) => v.files.length > 0);

export async function loadCatalog() {
  const config = await fetchJson(`/${configName}.json`);
  const firmwares = config.device.flatMap((device) => device.firmware);

  const sourceKeys = new Set(firmwares.map(releaseSourceKey).filter(Boolean));
  const releases = Object.fromEntries(
    await Promise.all(
      [...sourceKeys].map(async (key) => {
        try {
          return [key, await fetchJson(`/releases?repo=${key}`)];
        } catch {
          try {
            return [key, await fetchJson(`/releases-${key}.json`)];
          } catch {
            return [key, []];
          }
        }
      }),
    ),
  );

  for (const firmware of firmwares) {
    const key = releaseSourceKey(firmware);
    if (!firmware[key]?.files) continue;
    firmware.version = matchReleaseFiles(releases[key], firmware[key], key);
  }

  config.device = config.device.filter((device) =>
    device.firmware.some(hasVersions),
  );

  return config;
}

// Firmware title/icon/tooltip fall back to its role's defaults
export const roleValue = (config, firmware, key) =>
  firmware[key] ?? config.role[firmware.role]?.[key] ?? "";

// Notices may reference device fields, e.g. ${bootloader} (arrays use their first item)
export function renderNotice(config, device, firmware) {
  const notice = config.notice?.[firmware.notice] || firmware.notice || "";

  return notice.replaceAll(/\$\{(\w+)\}/g, (_, field) => {
    const value = device[field];
    return (Array.isArray(value) ? value[0] : value) || "";
  });
}

export function formatChangeLog(changelog) {
  return changelog
    .replace(/^Release notes:'/, "")
    .replace(/change log:\r?\n/i, "")
    .replaceAll(/^[-*] /gm, "")
    .replaceAll(
      /(?<!["'])(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gi,
      `<a target="_blank" href="$1">$1</a>`,
    )
    .replaceAll(
      /#(\d+)/gm,
      `<a target="_blank" href="https://github.com/burakcan/MeshCore-mishmesh/pull/$1">#$1</a>`,
    );
}

export const firmwareUrl = (config, file) => {
  if (file.name.startsWith("http")) return file.name;
  if (file.name.startsWith("/")) return file.name;
  return `${config.staticPath}/${file.name}`;
};
