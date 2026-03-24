# @openclaw/weixin

Weixin channel plugin for OpenClaw with multi-account QR onboarding.

## Features

- Multi-account Weixin login in one gateway process
- Per-account session isolation
- Local management page for QR login and diagnostics
- Text and media reply support (local file path or remote image URL)

## Install

```bash
openclaw plugins install @openclaw/weixin
```

For local development from an OpenClaw checkout:

```bash
openclaw plugins install --link ./extensions/weixin
```

## Minimal config

```json5
{
  session: {
    dmScope: "per-account-channel-peer",
  },
  plugins: {
    entries: {
      weixin: {
        enabled: true,
        package: "@openclaw/weixin",
      },
    },
  },
  channels: {
    weixin: {
      baseUrl: "https://ilinkai.weixin.qq.com",
      demoService: {
        enabled: true,
        bind: "127.0.0.1",
        port: 19120,
      },
    },
  },
}
```

After startup, open `http://127.0.0.1:19120/`, add a Weixin account, scan the QR code, then restart the gateway.

## Docs

- Weixin channel guide: https://docs.openclaw.ai/channels/weixin
- Plugin management: https://docs.openclaw.ai/tools/plugin

## Upstream attribution

This extension derives from `@tencent-weixin/openclaw-weixin` (v1.0.2), with additional OpenClaw integration and multi-account control surface changes.
