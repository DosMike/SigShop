import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Advance a source independently after testing that plugin against a newer game build.
const sources = [
  {
    id: "tfecondata",
    name: "SM-TFEconData",
    url: "https://github.com/nosoop/SM-TFEconData/blob/master/gamedata/tf2.econ_data.txt",
    raw: "https://raw.githubusercontent.com/nosoop/SM-TFEconData/master/gamedata/tf2.econ_data.txt",
    cache: "sigshop-econ.txt",
    testedVersion: 11076587,
  },
  {
    id: "tfutils",
    name: "SM-TFUtils",
    url: "https://github.com/nosoop/SM-TFUtils/blob/master/gamedata/tf2.utils.nosoop.txt",
    raw: "https://raw.githubusercontent.com/nosoop/SM-TFUtils/master/gamedata/tf2.utils.nosoop.txt",
    cache: "sigshop-utils.txt",
    testedVersion: 11076587,
  },
  {
    id: "mannvsmann",
    name: "MannVsMann",
    url: "https://github.com/Mikusch/MannVsMann/blob/master/addons/sourcemod/gamedata/mannvsmann.txt",
    raw: "https://raw.githubusercontent.com/Mikusch/MannVsMann/master/addons/sourcemod/gamedata/mannvsmann.txt",
    cache: "sigshop-mvm.txt",
    testedVersion: 11076587,
  },
  {
    id: "cbasenpc",
    name: "CBaseNPC",
    url: "https://github.com/TF2-DMB/CBaseNPC/blob/master/gamedata/cbasenpc.txt",
    raw: "https://raw.githubusercontent.com/TF2-DMB/CBaseNPC/master/gamedata/cbasenpc.txt",
    cache: "sigshop-cbasenpc.txt",
    testedVersion: 11076587,
  },
  {
    id: "tfdropweapon",
    name: "TF2-DropWeapon",
    url: "https://github.com/DosMike/TF2-DropWeapon/blob/master/gamedata/tfdropweapon.games.txt",
    raw: "https://raw.githubusercontent.com/DosMike/TF2-DropWeapon/master/gamedata/tfdropweapon.games.txt",
    cache: "sigshop-dropweapon.txt",
    testedVersion: 11076587,
  },
  {
    id: "pvpoptin",
    name: "TF2-PvP-OptIn",
    url: "https://github.com/DosMike/TF2-PvP-OptIn/blob/master/gamedata/pvpoptin.games.txt",
    raw: "https://raw.githubusercontent.com/DosMike/TF2-PvP-OptIn/master/gamedata/pvpoptin.games.txt",
    cache: "sigshop-pvpoptin.txt",
    testedVersion: 11076587,
  },
];

const platformNames = ["windows", "windows64", "linux", "linux64", "mac"];

function tokenize(input) {
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "/" && input[index + 1] === "/") {
      index = input.indexOf("\n", index + 2);
      if (index < 0) break;
      continue;
    }
    if (char === "/" && input[index + 1] === "*") {
      const end = input.indexOf("*/", index + 2);
      index = end < 0 ? input.length : end + 2;
      continue;
    }
    if (char === "{" || char === "}") {
      tokens.push(char);
      index += 1;
      continue;
    }
    if (char === '"') {
      let value = "";
      index += 1;
      while (index < input.length && input[index] !== '"') {
        if (input[index] === "\\" && input[index + 1] === '"') {
          value += '"';
          index += 2;
        } else {
          value += input[index];
          index += 1;
        }
      }
      index += 1;
      tokens.push(value);
      continue;
    }

    let end = index;
    while (end < input.length && !/[\s{}]/.test(input[end])) end += 1;
    tokens.push(input.slice(index, end));
    index = end;
  }
  return tokens;
}

function parseKeyValues(input) {
  const tokens = tokenize(input);
  let index = 0;

  function parseObject(expectClose = false) {
    const object = {};
    while (index < tokens.length) {
      if (tokens[index] === "}") {
        if (!expectClose) throw new Error("Unexpected closing brace");
        index += 1;
        return object;
      }
      const key = tokens[index++];
      const value = tokens[index++];
      if (value === "{") object[key] = parseObject(true);
      else if (value === undefined || value === "}") throw new Error(`Missing value for ${key}`);
      else object[key] = value;
    }
    if (expectClose) throw new Error("Unclosed KeyValues object");
    return object;
  }

  return parseObject();
}

function platformValues(definition = {}) {
  return Object.fromEntries(platformNames.filter((platform) => definition[platform] !== undefined).map((platform) => [platform, definition[platform]]));
}

function slugify(value) {
  const distinguishCallSuffix = value.replace(/\(\)$/, " function");
  return distinguishCallSuffix.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function scopeFor(name) {
  const separator = name.indexOf("::");
  return separator > 0 ? { scopeType: "class", scope: name.slice(0, separator) } : { scopeType: "global", scope: "Global" };
}

function isMemberOffset(name) {
  return /::m_[A-Za-z0-9]/.test(name);
}

function normalizeFunctionConfig(config) {
  return structuredClone(config);
}

async function loadSource(source, cacheDirectory) {
  if (cacheDirectory) return readFile(resolve(cacheDirectory, source.cache), "utf8");
  const response = await fetch(source.raw, { headers: { "User-Agent": "SigShop importer" } });
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  return response.text();
}

function addSource(entry, source) {
  if (!entry.sources.some((item) => item.id === source.id)) {
    entry.sources.push({ id: source.id, name: source.name, url: source.url, testedVersion: source.testedVersion });
  }
  const { testedVersion: _testedVersion, ...provider } = entry.sources[0];
  entry.provider = provider;
}

function createEntry(name, category, source) {
  const scope = scopeFor(name);
  const noun = category === "member" ? "Data-member offset" : category === "vtable" ? "Vtable function offset" : "Function signature";
  return {
    id: slugify(name),
    name,
    gamedataKey: name,
    category,
    ...scope,
    description: `${noun} sourced from ${source.name}.`,
    notes: "Imported from upstream gamedata. Check the linked source and current server binary before production use.",
    provider: { id: source.id, name: source.name, url: source.url },
    sources: [],
  };
}

async function buildDataset(cacheDirectory) {
  const entries = new Map();

  for (const source of sources) {
    if (!Number.isInteger(source.testedVersion)) {
      throw new TypeError(`${source.name}: testedVersion must be an integer`);
    }
  }

  function getEntry(name, category, source) {
    const mapKey = `${category === "member" ? "member" : "function"}:${name}`;
    if (!entries.has(mapKey)) entries.set(mapKey, createEntry(name, category, source));
    const entry = entries.get(mapKey);
    addSource(entry, source);
    return entry;
  }

  for (const source of sources) {
    const text = await loadSource(source, cacheDirectory);
    const parsed = parseKeyValues(text);
    const game = parsed.Games?.tf;
    if (!game) throw new Error(`${source.name}: no Games/tf section`);
    const signatures = game.Signatures || {};
    const offsets = game.Offsets || {};
    const functions = game.Functions || {};
    const callableOffsets = new Set(Object.values(functions).map((config) => config?.offset).filter(Boolean));

    for (const [name, definition] of Object.entries(signatures)) {
      if (!definition || typeof definition !== "object") continue;
      const values = platformValues(definition);
      if (!Object.keys(values).length) continue;
      const entry = getEntry(name, "function", source);
      entry.signature ||= { key: name, library: definition.library || "server", values: {} };
      entry.signature.values = { ...values, ...entry.signature.values };
    }

    for (const [name, definition] of Object.entries(offsets)) {
      if (!definition || typeof definition !== "object") continue;
      const member = isMemberOffset(name);
      const callable = callableOffsets.has(name) || /\(\)$/.test(name);
      if (!member && !callable) continue;
      const values = platformValues(definition);
      if (!Object.keys(values).length) continue;
      const category = member ? "member" : "vtable";
      const entry = getEntry(name, category, source);
      entry.offset ||= { key: name, kind: category, values: {} };
      entry.offset.values = { ...values, ...entry.offset.values };
    }

    for (const [name, config] of Object.entries(functions)) {
      if (!config || typeof config !== "object") continue;
      const signatureName = config.signature;
      const offsetName = config.offset;
      const signatureDefinition = signatures[signatureName];
      const offsetDefinition = offsets[offsetName];
      if (!signatureDefinition && !offsetDefinition) continue;

      const entry = getEntry(name, offsetDefinition && !signatureDefinition ? "vtable" : "function", source);
      entry.functionConfig = normalizeFunctionConfig(config);
      if (config.return) entry.returnType = config.return;
      if (config.arguments && typeof config.arguments === "object") {
        entry.parameters = Object.entries(config.arguments).map(([argumentName, definition]) => ({ name: argumentName, ...definition }));
      }
      if (signatureDefinition) {
        entry.signature = {
          key: signatureName,
          library: signatureDefinition.library || "server",
          values: platformValues(signatureDefinition),
        };
      }
      if (offsetDefinition) {
        entry.offset = { key: offsetName, kind: "vtable", values: platformValues(offsetDefinition) };
      }
      entry.description = `Callable ${config.callconv || "native"} function definition sourced from ${source.name}.`;
    }
  }

  return {
    schemaVersion: 1,
    game: {
      id: "tf",
      title: "Team Fortress 2",
      folder: "tf",
      appId: 440,
      engine: "Source",
      accent: "#ffb86a",
      defaultTestedVersion: Math.min(...sources.map((source) => source.testedVersion)),
      importedAt: new Date().toISOString().slice(0, 10),
      sourceCount: sources.length,
    },
    entries: [...entries.values()].sort((a, b) => `${a.scope}:${a.name}`.localeCompare(`${b.scope}:${b.name}`)),
  };
}

async function preserveImportedAtWhenUnchanged(dataset, output) {
  let previousDataset;
  try {
    previousDataset = JSON.parse(await readFile(output, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  const previousImportedAt = previousDataset.game?.importedAt;
  if (!previousImportedAt) return;

  const previousComparable = structuredClone(previousDataset);
  const nextComparable = structuredClone(dataset);
  delete previousComparable.game.importedAt;
  delete nextComparable.game.importedAt;

  if (JSON.stringify(previousComparable) === JSON.stringify(nextComparable)) {
    dataset.game.importedAt = previousImportedAt;
  }
}

const cacheFlag = process.argv.indexOf("--cache-dir");
const cacheDirectory = cacheFlag >= 0 ? process.argv[cacheFlag + 1] : null;
if (cacheFlag >= 0 && !cacheDirectory) throw new Error("--cache-dir requires a path");

const dataset = await buildDataset(cacheDirectory);
const output = resolve("public/data/tf2.json");
await preserveImportedAtWhenUnchanged(dataset, output);
await writeFile(output, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(`Imported ${dataset.entries.length} TF2 entries from ${sources.length} sources into ${output}`);
