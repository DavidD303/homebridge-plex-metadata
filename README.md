# Plex Metadata plugin for Homebridge

[![CI](https://github.com/davidmuzi/homebridge-plex-metadata/actions/workflows/ci.yml/badge.svg)](https://github.com/davidmuzi/homebridge-plex-metadata/actions/workflows/ci.yml)

Add sensors to monitor playback state while exposing rich metadata on the currently playing media

## Why this plugin exists

This plugin is built for people who want more than "is something playing?" from Plex in HomeKit. It exposes playback metadata as Homebridge characteristics so you can trigger automations based on what is actually on screen, not just whether a player is active.

A practical example is projector control. If a movie starts in `21:9`, you can use that metadata value to trigger a HomeKit automation that changes your projector lens memory/profile to match.

The occupancy sensor is still useful for simple "media started/stopped" flows, but the core value of this plugin is metadata-driven automations for advanced setups.

## How it works

This plugin leverages both webhooks (optional) and the /sessions API. Webhooks provide realtime updates when playback status changes. The /sessions API provides richer metadata, exposed as custom characteristics, which currently include:

- Aspect Ratio
- Resolution
- Audio Codec
- Video Codec

## Setup

1. Set your Plex server connection details:
   - `plexHost` (required): hostname or IP address of your Plex instance (for example `192.168.1.10`)
   - `plexPort` (required): Plex port (usually `32400`)

2. Set your Plex authentication token:
   - `plexToken` (required)
   - You can find it using Plex's instructions: [Finding an authentication token / X-Plex-Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)

3. Configure players that should get an occupancy sensor:
   - Add each player under `players` with:
     - `name`: the Homebridge accessory name you want to display
     - `uuid`: player identifier value (machine identifier)
     - `stopAtCredits` (optional): turn the occupancy sensor off at the first detected credits marker
     - `creditsOffsetSeconds` (optional): adjust the trigger relative to the marker; negative values trigger early

Set `pollIntervalSeconds` to control playback-position accuracy. A value of `5` is recommended for credits detection.

When `stopAtCredits` is enabled, the existing occupancy sensor remains on during active playback and turns off when playback reaches the first credits marker. It resets automatically when playback stops, a different item starts, or playback seeks back before the credits. Plex must have generated credits markers for the item.

4. Get player identifiers from Homebridge logs while media is playing:

```text
[homebridge-plex-metadata] Session:
Player machine identifier: some-uuid
Player title: Safari
```

In the example above, use either `some-uuid` or `Safari` as the `uuid` value for that player entry.

## Optional: Realtime updates with webhooks

You can enable Plex webhooks for realtime playback updates instead of relying only on polling.

- Requires a Plex Pass subscription to use webhooks.
- Enable `enableWebhooks` in plugin config.
- Optionally set `plexWebhookPort` (default `32500`).

After restarting Homebridge with webhooks enabled, look for a log line like:

```text
Plex webhook listener ready at http://0.0.0.0:32500/plex/webhook
```

Use that URL in Plex webhook settings:
- [Plex Webhooks Settings](https://app.plex.tv/desktop#!/settings/webhooks)

If Homebridge is running on another machine/NAS, replace `0.0.0.0` with the reachable IP/hostname for that Homebridge host.
