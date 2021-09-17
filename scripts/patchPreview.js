/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');

const args = process.argv.slice(2);
if (!args || args.length == 0) {
  throw new Error('No version parameter was provided.');
}

// Patch README.md
const insert = fs.readFileSync('./README.preview.md', { encoding: 'utf8' });
const data = fs.readFileSync('./README.md', { encoding: 'utf8' });
fs.writeFileSync('./README.md', `${insert}\n${data}`);

// Patch package.json
let json = require('../package.json');

json = JSON.stringify({
  ...json,
  name: `${json.name}-preview`,
  displayName: `${json.displayName} (Preview)`,
  description:
    'This is an preview release for functionality that is not yet officially released. This preview functionality will be removed in a couple of weeks and the functionality merged in the official release.',
  version: `${args[0]}-preview`,
  preview: true,
});
fs.writeFileSync('./package.json', json);
