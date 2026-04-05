import { charactersModuleId } from './characters/index.js';
import { chatsModuleId } from './chats/index.js';
import { generationModuleId } from './generation/index.js';
import { indexingModuleId } from './indexing/index.js';
import { lorebooksModuleId } from './lorebooks/index.js';
import { promptingModuleId } from './prompting/index.js';
import { providersModuleId } from './providers/index.js';
import { runtimeModuleId } from './runtime/index.js';
import { scenariosModuleId } from './scenarios/index.js';
import { settingsModuleId } from './settings/index.js';

export const approvedApiModules = [
  charactersModuleId,
  chatsModuleId,
  lorebooksModuleId,
  scenariosModuleId,
  settingsModuleId,
  providersModuleId,
  runtimeModuleId,
  promptingModuleId,
  generationModuleId,
  indexingModuleId,
] as const;
