import { render } from "lit";
import { describe, expect, it } from "vitest";
import { setLocale } from "./i18n/index.ts";
import { analyzeConfigSchema, renderConfigForm } from "./views/config-form.ts";

describe("config form enum i18n", () => {
  it("renders translated enum values for zh-CN", () => {
    setLocale("zh-CN");
    const schema = {
      type: "object",
      properties: {
        wizard: {
          type: "object",
          properties: {
            lastRunMode: { type: "string", enum: ["local", "remote"] },
          },
        },
      },
    };

    const analysis = analyzeConfigSchema(schema);
    const container = document.createElement("div");
    render(
      renderConfigForm({
        schema: analysis.schema,
        uiHints: {},
        unsupportedPaths: analysis.unsupportedPaths,
        value: { wizard: { lastRunMode: "local" } },
        onPatch: () => {},
      }),
      container,
    );

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".cfg-segmented__btn"),
    );
    const labels = buttons.map((button) => button.textContent?.trim() ?? "");
    expect(labels).toContain("本地");
    expect(labels).toContain("远程");
  });
});
