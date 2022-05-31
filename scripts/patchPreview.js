/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');

const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
const version = `${String(date.getFullYear())}.${date.getMonth() + 1}.${date.getDate()}${String(
  date.getHours(),
).padStart(2, '0')}`; // Follow GitLens extension versioning strategy

// Patch README.md
const insert = fs.readFileSync('./README.preview.md', { encoding: 'utf8' });
const data = fs.readFileSync('./README.md', { encoding: 'utf8' });
fs.writeFileSync('./README.md', `${insert}\n${data}`);

// Patch package.json
let json = require('../package.json');

json = JSON.stringify({
  ...json,
  name: `${json.name}-preview`,
  displayName: `(Preview) ${json.displayName}`,
  description: 'This is a preview release for functionality that is not yet officially released.',
  version: version,
  preview: true,
});
fs.writeFileSync('./package.json', json);

let snykConfigJson = require('../snyk.config.json');
snykConfigJson = JSON.stringify({
  ...snykConfigJson,
  segmentWriteKey: process.env.SNYK_VSCE_SEGMENT_WRITE_KEY,
  amplitudeExperimentApiKey: process.env.SNYK_VSCE_AMPLITUDE_EXPERIMENT_API_KEY,
  sentryKey: process.env.SNYK_VSCE_SENTRY_DSN_KEY,
});
fs.writeFileSync('./snyk.config.json', snykConfigJson);
