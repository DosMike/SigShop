# Catalog data schema

SigShop loads `public/data/games.json` first. Each item points to a static, per-game JSON document. This keeps catalog changes reviewable and makes it possible to update signatures without touching application code.

## Game manifest

```json
{
  "id": "tf",
  "title": "Team Fortress 2",
  "engine": "Source",
  "currentVersion": 11076587,
  "data": "./data/tf2.json"
}
```

`id` must match the SourceMod game key used in the exported `"Games"` section. Change `currentVersion` when the live game updates; entries tested against an older build will immediately appear as needing verification.

## Game document

```json
{
  "schemaVersion": 1,
  "game": {
  "id": "tf",
    "title": "Team Fortress 2",
    "folder": "tf",
    "appId": 440,
    "engine": "Source",
    "accent": "#ffb86a",
    "defaultTestedVersion": 11076587,
    "updated": "2026-08-27"
  },
  "entries": []
}
```

## Function entry

```json
{
  "id": "ctfplayer-forcerespawn",
  "name": "CTFPlayer::ForceRespawn",
  "gamedataKey": "CTFPlayer::ForceRespawn",
  "category": "function",
  "scopeType": "class",
  "scope": "CTFPlayer",
  "description": "Forces a player through the native respawn path.",
  "returnType": "void",
  "signature": {
    "key": "CTFPlayer::ForceRespawn",
    "library": "server",
    "values": {
      "windows": "\\x55\\x8B...",
      "linux": "@_ZN9CTFPlayer12ForceRespawnEv"
    }
  },
  "offset": {
    "key": "CTFPlayer::ForceRespawn",
    "kind": "vtable",
    "values": {
      "windows": 42,
      "linux": 43
    }
  },
  "notes": "Optional compatibility or usage notes.",
  "provider": {
    "name": "Contributor name",
    "url": "https://example.com/source"
  },
  "sources": [
    {
      "id": "example-source",
      "name": "Contributor name",
      "url": "https://example.com/source",
      "testedVersion": 11076587
    }
  ],
  "updated": "2026-08-27",
  "usage": {
    "DHooks": "SourcePawn example...",
    "SDKCall": "SourcePawn example...",
    "SDKHooks": "SourcePawn example..."
  }
}
```

An entry must contain `signature`, `offset`, or both. `category` is `function`, `vtable`, or `member`; `offset.kind` distinguishes vtable indices from data-member byte offsets. Platform values may contain `windows`, `windows64`, `linux`, `linux64`, and `mac`.

An optional `functionConfig` object preserves a SourceMod `Functions` definition, including `signature` or `offset`, `callconv`, `return`, `this`, and nested `arguments`. SigShop emits that definition alongside its referenced signature or offset during checkout.

Verification is resolved in this order: an entry-level `testedVersion` override, the oldest `sources[].testedVersion` contributing to the entry, then `game.defaultTestedVersion` as a fallback. After a game update, change only `currentVersion` in `games.json`; older source data will automatically need verification. When an imported plugin has been tested, update that source's `testedVersion` in the import script and regenerate the catalog. Use an entry-level override only when one entry was tested independently.

Put every upstream file in `sources`, record the game build against which it was tested, and retain `provider` as the primary display source. For entries assembled from multiple sources, using the oldest tested build is deliberately conservative.
