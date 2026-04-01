export {
  findMatrixAccountEntry,
  requiresExplicitMatrixDefaultAccount,
  resolveConfiguredMatrixAccountIds,
  resolveMatrixChannelConfig,
  resolveMatrixDefaultOrOnlyAccountId,
} from "./src/account-selection.js";
export { resolveMatrixAccountStringValues } from "./src/auth-precedence.js";
export { getMatrixScopedEnvVarNames } from "./src/env-vars.js";
export {
  resolveMatrixAccountStorageRoot,
  resolveMatrixCredentialsPath,
  resolveMatrixLegacyFlatStoragePaths,
} from "./src/storage-paths.js";
