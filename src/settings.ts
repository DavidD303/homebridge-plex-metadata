import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const configSchema = require('../config.schema.json');
const packageJson = require('../package.json');

export const PLATFORM_NAME = configSchema.pluginAlias;
export const PLUGIN_NAME = packageJson.name;
