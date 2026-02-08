import { describe, expect, it } from "vitest";
import { setLocale } from "./i18n/index.ts";
import { subtitleForTab, titleForTab } from "./navigation.ts";

describe("navigation i18n", () => {
  it("translates usage tab in zh-CN", () => {
    setLocale("zh-CN");
    expect(titleForTab("usage")).toBe("用量");
    expect(subtitleForTab("usage")).toContain("令牌");
  });

  it("translates usage tab in en", () => {
    setLocale("en");
    expect(titleForTab("usage")).toBe("Usage");
    expect(subtitleForTab("usage")).toContain("token");
  });
});
