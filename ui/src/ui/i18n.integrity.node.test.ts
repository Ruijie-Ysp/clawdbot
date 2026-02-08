import { describe, expect, it } from "vitest";
import { hasTranslation, setLocale, t } from "./i18n/index.ts";

const REQUIRED_KEYS = [
  "nav.usage",
  "pageSubtitles.usage",
  "agents.tools.sections.fs",
  "agents.tools.toolDescriptions.apply_patch",
  "agents.skills.groups.workspace",
  "agents.skills.groups.built-in",
  "configForm.values.wizard.lastRunMode.local",
  "configForm.values.wizard.lastRunMode.remote",
] as const;

const REQUIRED_ZH_KEYS = [
  "configForm.fields.lastRunAt",
  "configForm.fields.lastRunVersion",
  "configForm.fields.lastRunCommit",
  "configForm.fields.lastRunCommand",
  "configForm.fields.lastRunMode",
] as const;

describe("i18n integrity", () => {
  it("keeps required translation keys in en", () => {
    setLocale("en");
    for (const key of REQUIRED_KEYS) {
      expect(hasTranslation(key), `missing en key: ${key}`).toBe(true);
      expect(t(key), `invalid en translation for ${key}`).not.toBe(key);
    }
  });

  it("keeps required translation keys in zh-CN", () => {
    setLocale("zh-CN");
    for (const key of REQUIRED_KEYS) {
      expect(hasTranslation(key), `missing zh-CN key: ${key}`).toBe(true);
      expect(t(key), `invalid zh-CN translation for ${key}`).not.toBe(key);
    }
    for (const key of REQUIRED_ZH_KEYS) {
      expect(hasTranslation(key), `missing zh-CN key: ${key}`).toBe(true);
      expect(t(key), `invalid zh-CN translation for ${key}`).not.toBe(key);
    }
  });
});
