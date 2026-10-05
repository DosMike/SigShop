import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { generateGameData } from "../lib/gamedata.js";
import { scoreSearchResult } from "../lib/search.js";
import { getTestedVersion, isEntryVerified } from "../lib/verification.js";

const ROOT = new URL("../", import.meta.url);

test("search scores title hits at twice the metadata weight", () => {
  const titleHit = scoreSearchResult({ name: "CTFPlayer::ForceRespawn" }, "respawn");
  const descriptionHit = scoreSearchResult({ name: "CTFPlayer::Other", description: "Forces a respawn" }, "respawn");

  assert.equal(titleHit, descriptionHit * 2);
});

test("search requires every query term to match", () => {
  const entry = { name: "CTFPlayer::ForceRespawn", scope: "CTFPlayer" };
  assert.ok(scoreSearchResult(entry, "player respawn") > 0);
  assert.equal(scoreSearchResult(entry, "player missing"), 0);
});

test("verification follows source versions with entry and dataset fallbacks", () => {
  const dataset = { game: { defaultTestedVersion: 100 } };
  const game = { currentVersion: 100 };
  assert.equal(getTestedVersion({}, dataset), "100");
  assert.equal(isEntryVerified({}, dataset, game), true);
  assert.equal(isEntryVerified({}, dataset, { currentVersion: 101 }), false);
  assert.equal(getTestedVersion({ sources: [{ testedVersion: 102 }] }, dataset), "102");
  assert.equal(getTestedVersion({ sources: [{ testedVersion: 102 }, { testedVersion: 101 }] }, dataset), "101");
  assert.equal(isEntryVerified({ testedVersion: 101 }, dataset, { currentVersion: 101 }), true);
  assert.equal(getTestedVersion({ testedVersion: 103, sources: [{ testedVersion: 102 }] }, dataset), "103");
});

test("generateGameData groups signatures and offsets by game", () => {
  const items = [
    {
      game: { id: "example" },
      entry: {
        name: "CExample::Call",
        signature: { key: "CExample::CallSig", library: "server", values: { windows: "\\xAA\\xBB", linux: "@Example", linux64: "@Example64" } },
        offset: { key: "CExample::CallOffset", kind: "vtable", values: { windows: 42, linux: 43 } },
        functionConfig: {
          signature: "CExample::CallSig",
          callconv: "thiscall",
          return: "bool",
          this: "entity",
          arguments: { amount: { type: "int" } },
        },
      },
    },
  ];

  const output = generateGameData(items, new Date("2026-01-02T03:04:05.000Z"));
  assert.match(output, /"Games"/);
  assert.match(output, /"example"/);
  assert.match(output, /"Signatures"/);
  assert.match(output, /"CExample::CallSig"/);
  assert.match(output, /"library"\s+"server"/);
  assert.ok(output.includes('"windows"\t"\\xAA\\xBB"'));
  assert.match(output, /"Offsets"/);
  assert.match(output, /"linux"\s+"43"/);
  assert.match(output, /"linux64"\s+"@Example64"/);
  assert.match(output, /"Functions"/);
  assert.match(output, /"callconv"\s+"thiscall"/);
  assert.match(output, /"amount"[\s\S]+"type"\s+"int"/);
});

test("all game catalogs satisfy the public data contract", async () => {
  const manifest = JSON.parse(await readFile(new URL("public/data/games.json", ROOT), "utf8"));
  assert.ok(manifest.length >= 1);

  for (const descriptor of manifest) {
    assert.ok(Number.isInteger(descriptor.currentVersion), `${descriptor.id}: currentVersion must be an integer`);
    const relativePath = descriptor.data.replace(/^\.\//, "public/");
    const dataset = JSON.parse(await readFile(new URL(relativePath, ROOT), "utf8"));
    assert.equal(dataset.schemaVersion, 1);
    assert.equal(dataset.game.id, descriptor.id);
    assert.ok(Number.isInteger(dataset.game.defaultTestedVersion), `${descriptor.id}: defaultTestedVersion must be an integer`);
    assert.ok(dataset.entries.length >= 1);

    const ids = new Set();
    for (const entry of dataset.entries) {
      assert.ok(entry.id && entry.name && entry.scope && entry.description, `${descriptor.id}: incomplete entry`);
      assert.ok(entry.signature || entry.offset, `${descriptor.id}:${entry.id} has no downloadable data`);
      assert.ok(!ids.has(entry.id), `${descriptor.id}:${entry.id} is duplicated`);
      ids.add(entry.id);

      if (entry.signature) {
        assert.ok(entry.signature.library, `${descriptor.id}:${entry.id} has no library`);
        assert.ok(Object.keys(entry.signature.values || {}).length, `${descriptor.id}:${entry.id} has no signature values`);
      }
      if (entry.offset) {
        assert.ok(Object.keys(entry.offset.values || {}).length, `${descriptor.id}:${entry.id} has no offset values`);
        if (entry.category === "member" || entry.category === "vtable") {
          assert.equal(entry.offset.kind, entry.category, `${descriptor.id}:${entry.id} has the wrong offset kind`);
        }
      }
      if (entry.functionConfig?.signature) {
        assert.equal(entry.signature?.key, entry.functionConfig.signature, `${descriptor.id}:${entry.id} is missing its referenced signature`);
      }
      if (entry.functionConfig?.offset) {
        assert.equal(entry.offset?.key, entry.functionConfig.offset, `${descriptor.id}:${entry.id} is missing its referenced offset`);
      }
      assert.ok(getTestedVersion(entry, dataset), `${descriptor.id}:${entry.id} has no tested version`);
      if (entry.testedVersion !== undefined) {
        assert.ok(Number.isInteger(entry.testedVersion), `${descriptor.id}:${entry.id} testedVersion must be an integer`);
      }
      for (const source of entry.sources || []) {
        assert.ok(Number.isInteger(source.testedVersion), `${descriptor.id}:${entry.id}:${source.id} testedVersion must be an integer`);
      }
    }
  }
});
