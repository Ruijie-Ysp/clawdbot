---
summary: "Weixin channel plugin with multi-account QR onboarding"
read_when:
  - You want to connect OpenClaw to Weixin
  - You need multi-account Weixin login on one gateway
title: "Weixin"
---

# Weixin

Status: optional plugin (installed on demand).

The Weixin plugin adds Tencent Weixin bot connectivity with:

- Multi-account QR login support
- Per-account session isolation
- A local control page for login and diagnostics

## Install

Install from npm:

```bash
openclaw plugins install @openclaw/weixin
```

Install from a local source checkout:

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/weixin
```

Restart the gateway after install or enablement.

## Quick setup

1. Add config:

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

2. Start or restart the gateway.
3. Open `http://127.0.0.1:19120/`.
4. Click **Add WeChat Channel** and scan QR with Weixin.
5. After login succeeds, restart the gateway, then send a message from that Weixin account.

Repeat step 4 for each additional account.

## Capabilities

- Direct messages: supported
- Multi-account login: supported
- Local file and remote image outbound media: supported
- Group chat: not supported yet

## Configuration reference

| Key                                          | Type    | Default                         | Description                                       |
| -------------------------------------------- | ------- | ------------------------------- | ------------------------------------------------- |
| `channels.weixin.enabled`                    | boolean | `true`                          | Enable or disable the channel                     |
| `channels.weixin.baseUrl`                    | string  | `https://ilinkai.weixin.qq.com` | Upstream Weixin API base URL                      |
| `channels.weixin.cdnBaseUrl`                 | string  | `https://wework.qpic.cn`        | CDN base URL used for media upload/download       |
| `channels.weixin.routeTag`                   | number  | unset                           | Optional route tag header for upstream routing    |
| `channels.weixin.logUploadUrl`               | string  | unset                           | Default URL for `openclaw weixin logs-upload`     |
| `channels.weixin.accounts`                   | object  | `{}`                            | Per-account overrides and stored account metadata |
| `channels.weixin.demoService.enabled`        | boolean | `true`                          | Enable local management page                      |
| `channels.weixin.demoService.bind`           | string  | `127.0.0.1`                     | Local bind address for the management page        |
| `channels.weixin.demoService.port`           | number  | `19120`                         | Local port for the management page                |
| `channels.weixin.demoService.restartCommand` | string  | `openclaw gateway restart`      | Command shown in UI after QR login                |

## CLI helper

The plugin registers:

```bash
openclaw weixin logs-upload --url <upload-url> [--file <YYYYMMDD|filename>]
```

This uploads an OpenClaw log file to a remote endpoint with multipart form data.

## Troubleshooting

- QR never confirms:
  - Check network access to `channels.weixin.baseUrl`.
  - Regenerate QR and rescan.
- Replies are not sent:
  - Confirm the account is logged in and appears in the local management page.
  - Restart the gateway after successful QR scan.
- Media send fails:
  - Verify remote media URLs are reachable.
  - Check `channels.weixin.cdnBaseUrl` and outbound network egress.

## Security notes

- Do not commit live account tokens or user identifiers.
- Keep the demo service bound to loopback unless you explicitly need remote access.
- Use pairing and allowlist policies as needed for your deployment.
