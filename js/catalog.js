// Device/firmware catalog: static config (config*.json) merged with GitHub releases served by /releases
import { configName } from './site.js';
import { fetchJson } from './util.js';

// Display order and headings of firmware groups on the "choose role" screen
export const firmwareClasses = {
  ripple: {
    title: 'Ripple Firmware',
    tooltip: 'Freemium firmware provided by <a class="inverse-link" target="_blank" href="https://buymeacoffee.com/ripplebiz">Ripple Radios</a>',
  },
  meshos: {
    title: 'MeshOS Firmware',
    tooltip: 'Freemium firmware provided by Andy Kirby',
  },
  community: {
    title: 'Community Firmware',
    tooltip: 'Open Source <a class="inverse-link" target="_blank" href="https://github.com/meshcore-dev/MeshCore">Community firmware</a>',
  },
};

// A firmware entry names its release source with a "github*" key, e.g. "github-zephcore": { type, files }
const releaseSourceKey = (firmware) => Object.keys(firmware).find(key => key.startsWith('github'));

// Builds firmware.version from releases: { [version]: { notes, files: [{ type, name, title }] } }
// `source.files` maps file type (flash, flash-wipe, flash-update, download) to a filename regex.
function matchReleaseFiles(releases, source, sourceKey) {
  const patterns = Object.entries(source.files).map(([type, re]) => [type, new RegExp(re)]);
  const versions = {};

  for(const [type, re] of patterns) {
    for(const release of releases) {
      if(release.type !== source.type) continue;
      const version = versions[release.version] ??= { notes: release.notes, files: [] };

      for(const file of release.files) {
        if(!re.test(file.name)) continue;
        version.files.push({ type, name: `${file.url}?repo=${sourceKey}`, title: file.name });
      }
    }
  }

  for(const [name, version] of Object.entries(versions)) {
    if(version.files.length === 0) delete versions[name];
  }

  return versions;
}

export const hasVersions = (firmware) => Object.values(firmware.version ?? {}).some(v => v.files.length > 0);

export async function loadCatalog() {
  const config = await fetchJson(`/${configName}.json`);
  const firmwares = config.device.flatMap(device => device.firmware);

  const sourceKeys = new Set(firmwares.map(releaseSourceKey).filter(Boolean));
  const releases = Object.fromEntries(await Promise.all(
    [...sourceKeys].map(async key => [key, await fetchJson(`/releases?repo=${key}`)])
  ));

  for(const firmware of firmwares) {
    const key = releaseSourceKey(firmware);
    if(!firmware[key]?.files) continue;
    firmware.version = matchReleaseFiles(releases[key], firmware[key], key);
  }

  config.device = config.device.filter(device => device.firmware.some(hasVersions));

  return config;
}

// Firmware title/icon/tooltip fall back to its role's defaults
export const roleValue = (config, firmware, key) => firmware[key] ?? config.role[firmware.role]?.[key] ?? '';

// Notices may reference device fields, e.g. ${bootloader} (arrays use their first item)
export function renderNotice(config, device, firmware) {
  const notice = config.notice?.[firmware.notice] || firmware.notice || '';

  return notice.replaceAll(/\$\{(\w+)\}/g, (_, field) => {
    const value = device[field];
    return (Array.isArray(value) ? value[0] : value) || '';
  });
}

export function formatChangeLog(changelog) {
  return changelog
    .replace(/^Release notes:'/, '')
    .replace(/change log:\r?\n/i, '')
    .replaceAll(/^[-*] /mg, '')
    .replaceAll(/(?<!["'])(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*))/gi, `<a target="_blank" href="$1">$1</a>`)
    .replaceAll(/#(\d+)/gm, `<a target="_blank" href="https://github.com/meshcore-dev/MeshCore/pull/$1">#$1</a>`);
}

export const firmwareUrl = (config, file) => file.name.startsWith('/') ? file.name : `${config.staticPath}/${file.name}`;
