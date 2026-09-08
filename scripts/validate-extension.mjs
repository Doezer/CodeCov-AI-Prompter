import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadJson(relativePath) {
  const content = await readFile(path.join(rootDir, relativePath), 'utf8');
  return JSON.parse(content);
}

async function loadText(relativePath) {
  return readFile(path.join(rootDir, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const manifest = await loadJson('manifest.json');
const popupHtml = await loadText('popup.html');
const popupJs = await loadText('popup.js');
const scraperJs = await loadText('scraper.js');

assert(manifest.manifest_version === 3, 'manifest.json must use Manifest V3.');
assert(manifest.action?.default_popup === 'popup.html', 'manifest.json must point to popup.html.');
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes('activeTab'), 'manifest.json must request activeTab.');
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes('scripting'), 'manifest.json must request scripting.');
assert(Array.isArray(manifest.permissions) && manifest.permissions.includes('clipboardWrite'), 'manifest.json must request clipboardWrite.');
assert(
  Array.isArray(manifest.host_permissions) &&
    manifest.host_permissions.some((pattern) => /codecov\.io/.test(pattern)),
  'manifest.json must scope host_permissions to codecov.io.'
);
assert(manifest.icons?.['128'] === 'icons/icon128.png', 'manifest.json must reference icons/icon128.png.');

assert(/<title>Codecov Coverage Fixer Prompt<\/title>/i.test(popupHtml), 'popup.html must include a title.');
assert(/id="generate"/i.test(popupHtml), 'popup.html must contain the generate button.');
assert(/id="copy"/i.test(popupHtml), 'popup.html must contain the copy button.');
assert(/id="output"/i.test(popupHtml), 'popup.html must contain the output textarea.');
assert(/id="status"/i.test(popupHtml), 'popup.html must contain the status element.');

assert(/chrome\.scripting\.executeScript/.test(popupJs), 'popup.js must inject the scraper into the active tab.');
assert(/files:\s*\[["']scraper\.js["']\]/.test(popupJs), 'popup.js must inject scraper.js.');
assert(/function\s+isCodecovUrl\s*\(/.test(popupJs), 'popup.js must define the codecov.io URL guard.');
assert(/function\s+buildPrompt\s*\(/.test(popupJs), 'popup.js must define buildPrompt.');

assert(/function\s+scrapeCodecovPage\s*\(/.test(scraperJs), 'scraper.js must define scrapeCodecovPage.');

console.log('Extension validation passed.');
