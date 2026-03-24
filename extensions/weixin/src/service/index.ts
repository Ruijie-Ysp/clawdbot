import type { OpenClawPluginApi, OpenClawPluginService } from "openclaw/plugin-sdk/core";
import { resolveWeixinDemoServiceConfig } from "./config.js";
import { WeixinDemoHttpServer } from "./http-server.js";

export function createWeixinDemoService(_api: OpenClawPluginApi): OpenClawPluginService {
  let server: WeixinDemoHttpServer | null = null;

  return {
    id: "weixin-demo-service",
    start: async (ctx) => {
      const config = resolveWeixinDemoServiceConfig(ctx.config);
      if (!config.enabled) {
        ctx.logger.info("[weixin] demo service disabled by config");
        return;
      }
      server = new WeixinDemoHttpServer({
        logger: ctx.logger,
        config: ctx.config,
      });
      await server.start();
    },
    stop: async () => {
      if (!server) {
        return;
      }
      await server.stop();
      server = null;
    },
  };
}
