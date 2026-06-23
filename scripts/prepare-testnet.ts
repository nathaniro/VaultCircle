import {
  assertDeploymentConfigConsistency,
  assertNetwork,
  assertSafePublicDeploymentConfig,
  syncTestnetSettings
} from "./lib/config.js";

assertNetwork("testnet");
assertSafePublicDeploymentConfig();
assertDeploymentConfigConsistency();

const settingsPath = syncTestnetSettings();

console.log(`Generated ${settingsPath} from the current .env configuration.`);
