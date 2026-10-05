# SigShop

I always wanted a website where I can just mix and match signatures for SourceMod gamedata files.
Never got around to finish it, so I asked the slop machine to create it for me.
Thanks to all the great devs in the community that put hard work into figuring out signatures for decades.
This project currently imports from some good reference gamedata files, with links back to the repos. Feel free to contribute.

Ok, enough of me yapping. Be careful: Slop ahead!

---

SigShop is a static, GitHub Pages–ready catalog for SourceMod function signatures and vtable offsets. Visitors can browse by game and class, inspect provenance and SourcePawn examples, add functions to a cart, and download a ready-to-load SourceMod KeyValues gamedata file.

The interface is built with [Lit](https://lit.dev/) web components and Vite. Catalog content lives in static, per-game JSON files; there is no backend or runtime configuration.

> [!WARNING]
> The TF2 catalog is imported from attributed community gamedata, but records remain marked source-reported until independently checked against the current game binaries. Signatures and layouts can change after any game update.

## Local development

Requirements: Node.js 20.19 or newer.

```sh
npm install
npm run dev
```

Run the data-contract tests and create the production build with:

```sh
npm run check
```

The deployable output is written to `dist/`. Vite uses relative asset URLs, so the same build works on a GitHub Pages user site or under a repository subpath.

## Add or update catalog data

1. Add the game to `public/data/games.json`.
2. Create its per-game document in `public/data/`.
3. Run `npm test` to validate IDs, required fields, and downloadable values.

See [the catalog data schema](docs/data-schema.md) for every supported field and a complete entry example.

The TF2 seed catalog can be regenerated manually from its six configured upstream repositories:

```sh
npm run import:tf2
```

The importer intentionally keeps callable signatures, vtable functions, SourceMod `Functions` definitions, and namespaced `m_` data-member offsets. It excludes unrelated `Addresses`, `Keys`, and ambiguous raw offsets. Review the generated diff before committing upstream changes. The automated refresh workflow runs every Monday at 04:17 UTC, can be started manually, and also runs when the importer configuration changes. It validates and commits only meaningful catalog changes.

The [public Source SDK 2013 game code](https://github.com/ValveSoftware/source-sdk-2013/tree/master/src/game) is the primary reference for resolving ambiguous names and reconstructing call signatures. The importer does not guess when a gamedata key lacks enough information to classify it safely.

## Game-version verification

`public/data/games.json` stores the currently deployed numeric build in `currentVersion`. Each configured TF2 source has its own numeric `testedVersion`, which is copied into generated source metadata. An individual entry may override its sources with `testedVersion`, while `game.defaultTestedVersion` remains the fallback for records without versioned sources.

When TF2 updates, changing `currentVersion` once marks older entries as needing verification. After testing a plugin, update that source's `testedVersion` in `scripts/import-tf2-gamedata.mjs` and rerun the importer; every entry sourced from that plugin updates together. Entries assembled from multiple sources conservatively use the oldest contributing version.

## GitHub Pages deployment

The workflow at `.github/workflows/deploy-pages.yml` tests, builds, and deploys every push to `main`. In the repository settings, choose **GitHub Actions** as the Pages source. Manual runs are also available from the Actions tab.

## Project structure

```text
src/
  components/            Lit web components
  sig-shop-app.js        Application state and views
lib/gamedata.js          SourceMod KeyValues generator
public/data/              Static game catalogs
tests/                    Generator and schema checks
```

## License

The application code is available under the MIT License. Signature data retains the attribution supplied in each catalog entry.
