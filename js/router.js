// URL scheme: /[class-]<device>/<role>/<version>, plus /console
// A class prefix (e.g. /ripple-lilygo-t-deck/) limits the device's firmware list to that class.
// NOTE: the server must serve index.html for all unknown paths (catch-all / try_files).
import { firmwareClasses, hasVersions, roleValue } from './catalog.js';
import { toSlug } from './util.js';

export const CONSOLE_PATH = '/console';

function firmwareSlug(config, firmware) {
  const title = roleValue(config, firmware, 'title');
  const subTitle = roleValue(config, firmware, 'subTitle');

  return toSlug(subTitle ? `${title}-${subTitle}` : title);
}

export function buildPath(config, { device, firmware, version, firmwareClass }) {
  if(!device) return '/';
  let path = `/${firmwareClass ? `${firmwareClass}-` : ''}${toSlug(device.name)}/`;
  if(!firmware) return path;
  path += `${firmwareSlug(config, firmware)}/`;
  if(version) path += toSlug(version);

  return path;
}

// Returns as much of the selection as the path matches; unknown segments are ignored
export function parsePath(config, path) {
  const selection = { device: null, firmware: null, version: null, firmwareClass: null };
  let [deviceSlug, roleSlug, versionSlug] = path.split('/').filter(Boolean);
  if(!deviceSlug) return selection;

  const firmwareClass = Object.keys(firmwareClasses).find(cls => deviceSlug.startsWith(`${cls}-`));
  if(firmwareClass) {
    selection.firmwareClass = firmwareClass;
    deviceSlug = deviceSlug.slice(firmwareClass.length + 1);
  }

  const devices = config.device.filter(d => toSlug(d.name) === deviceSlug);
  if(devices.length === 0) return selection;

  // several devices may share a slug, the role picks the right one
  const findFirmware = (device) => device.firmware.find(f => hasVersions(f) && firmwareSlug(config, f) === roleSlug);
  const device = (roleSlug && devices.find(findFirmware)) || devices[0];
  selection.device = device;
  if(!roleSlug) return selection;

  const firmware = findFirmware(device);
  if(!firmware) return selection;
  selection.firmware = firmware;
  selection.version = Object.keys(firmware.version).find(v => toSlug(v) === versionSlug) ?? null;

  return selection;
}

// Version changes only refine the current page, so they replace the history entry instead of pushing
export function isSamePage(pathA, pathB) {
  const [deviceA, roleA] = pathA.split('/').filter(Boolean);
  const [deviceB, roleB] = pathB.split('/').filter(Boolean);

  return Boolean(roleA) && deviceA === deviceB && roleA === roleB;
}
