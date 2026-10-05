import { LitElement, html, nothing } from "lit";
import "./components/function-card.js";
import "./components/cart-drawer.js";
import "./components/call-definition.js";
import { downloadTextFile, generateGameData } from "../lib/gamedata.js";
import { scoreSearchResult } from "../lib/search.js";
import { getCurrentVersion, getTestedVersion, isEntryVerified } from "../lib/verification.js";

const CART_KEY = "sigshop-cart-v1";

function loadStoredCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export class SigShopApp extends LitElement {
  static properties = {
    manifest: { state: true },
    datasets: { state: true },
    currentGameId: { state: true },
    query: { state: true },
    scope: { state: true },
    scopeQuery: { state: true },
    kinds: { state: true },
    verifiedOnly: { state: true },
    sort: { state: true },
    cart: { state: true },
    detailId: { state: true },
    cartOpen: { state: true },
    toastMessage: { state: true },
    loadError: { state: true },
    loading: { state: true },
  };

  constructor() {
    super();
    this.manifest = [];
    this.datasets = new Map();
    this.currentGameId = "";
    this.query = "";
    this.scope = "all";
    this.scopeQuery = "";
    this.kinds = new Set();
    this.verifiedOnly = false;
    this.sort = "name";
    this.cart = loadStoredCart();
    this.detailId = null;
    this.cartOpen = false;
    this.toastMessage = "";
    this.loadError = "";
    this.loading = true;
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleKeydown);
    this.initialize();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeydown);
    super.disconnectedCallback();
  }

  updated(changed) {
    if (changed.has("cartOpen")) document.body.classList.toggle("no-scroll", this.cartOpen);
  }

  get dataset() {
    return this.datasets.get(this.currentGameId);
  }

  get gameDescriptor() {
    return this.manifest.find((game) => game.id === this.currentGameId);
  }

  entryIsVerified(entry) {
    return isEntryVerified(entry, this.dataset, this.gameDescriptor);
  }

  get detailEntry() {
    return this.dataset?.entries.find((entry) => entry.id === this.detailId);
  }

  get cartData() {
    return this.cart.map((item) => {
      const dataset = this.datasets.get(item.gameId);
      const entry = dataset?.entries.find((candidate) => candidate.id === item.entryId);
      return entry ? { game: dataset.game, entry } : null;
    }).filter(Boolean);
  }

  get scopes() {
    const counts = new Map();
    for (const entry of this.dataset?.entries || []) {
      const name = entry.scopeType === "global" ? "Global functions" : entry.scope;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => {
      if (a === "Global functions") return -1;
      if (b === "Global functions") return 1;
      return a.localeCompare(b);
    });
  }

  get visibleScopes() {
    const query = this.scopeQuery.trim().toLowerCase();
    return query ? this.scopes.filter(([scope]) => scope.toLowerCase().includes(query)) : this.scopes;
  }

  get filteredEntries() {
    const query = this.query.trim().toLowerCase();
    const scores = new Map();
    return (this.dataset?.entries || [])
      .filter((entry) => {
        const scope = entry.scopeType === "global" ? "Global functions" : entry.scope;
        if (this.scope !== "all" && scope !== this.scope) return false;
        if (this.kinds.size && ![...this.kinds].every((kind) => {
          if (kind === "signature") return Boolean(entry.signature);
          if (kind === "vtable") return entry.offset?.kind === "vtable";
          if (kind === "member") return entry.offset?.kind === "member";
          return false;
        })) return false;
        if (this.verifiedOnly && !this.entryIsVerified(entry)) return false;
        if (!query) return true;
        const score = scoreSearchResult(entry, query);
        scores.set(entry, score);
        return score > 0;
      })
      .sort((a, b) => {
        if (query) {
          const relevance = scores.get(b) - scores.get(a);
          if (relevance) return relevance;
        }
        if (this.sort === "updated") return (b.updated || "").localeCompare(a.updated || "");
        if (this.sort === "scope") return `${a.scope} ${a.name}`.localeCompare(`${b.scope} ${b.name}`);
        return a.name.localeCompare(b.name);
      });
  }

  async loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
    return response.json();
  }

  async loadDataset(gameId) {
    if (!this.datasets.has(gameId)) {
      const game = this.manifest.find((item) => item.id === gameId);
      if (!game) throw new Error(`Unknown game: ${gameId}`);
      const dataset = await this.loadJson(game.data);
      this.datasets = new Map(this.datasets).set(gameId, dataset);
    }
    return this.datasets.get(gameId);
  }

  async initialize() {
    try {
      this.manifest = await this.loadJson("./data/games.json");
      const requested = new URLSearchParams(location.search).get("game");
      this.currentGameId = this.manifest.some((game) => game.id === requested) ? requested : this.manifest[0]?.id;
      if (!this.currentGameId) throw new Error("No games are configured.");
      await this.loadDataset(this.currentGameId);
      await Promise.all([...new Set(this.cart.map((item) => item.gameId))]
        .filter((id) => this.manifest.some((game) => game.id === id))
        .map((id) => this.loadDataset(id)));
      this.cart = this.cart.filter((item) => this.datasets.get(item.gameId)?.entries.some((entry) => entry.id === item.entryId));
      this.persistCart();
    } catch (error) {
      console.error(error);
      this.loadError = error instanceof Error ? error.message : "The catalog could not be loaded.";
    } finally {
      this.loading = false;
    }
  }

  async selectGame(gameId) {
    this.loading = true;
    try {
      await this.loadDataset(gameId);
      this.currentGameId = gameId;
      this.scope = "all";
      this.scopeQuery = "";
      const url = new URL(window.location.href);
      url.searchParams.set("game", gameId);
      history.replaceState(null, "", url);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : "This game catalog could not be loaded.";
    } finally {
      this.loading = false;
    }
  }

  isInCart(entryId, gameId = this.currentGameId) {
    return this.cart.some((item) => item.key === `${gameId}:${entryId}`);
  }

  toggleCart(entryId) {
    const key = `${this.currentGameId}:${entryId}`;
    const exists = this.cart.some((item) => item.key === key);
    this.cart = exists
      ? this.cart.filter((item) => item.key !== key)
      : [...this.cart, { key, gameId: this.currentGameId, entryId }];
    this.persistCart();
    this.showToast(exists ? "Removed from gamedata cart" : "Added to gamedata cart");
  }

  persistCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(this.cart));
  }

  resetFilters() {
    this.query = "";
    this.scope = "all";
    this.scopeQuery = "";
    this.kinds = new Set();
    this.verifiedOnly = false;
  }

  toggleKind(kind, checked) {
    const next = new Set(this.kinds);
    checked ? next.add(kind) : next.delete(kind);
    this.kinds = next;
  }

  removeFilter(key) {
    if (key === "query") this.query = "";
    if (key === "scope") this.scope = "all";
    if (key === "verified") this.verifiedOnly = false;
    if (key.startsWith("kind:")) this.toggleKind(key.split(":")[1], false);
  }

  showDetail(entryId) {
    this.detailId = entryId;
    this.updateComplete.then(() => this.querySelector("#detail-dialog")?.showModal());
  }

  closeDetail() {
    this.querySelector("#detail-dialog")?.close();
    this.detailId = null;
  }

  async copyValue(value) {
    try {
      await navigator.clipboard.writeText(String(value));
      this.showToast("Copied to clipboard");
    } catch {
      this.showToast("Clipboard access was blocked");
    }
  }

  showToast(message) {
    this.toastMessage = message;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => { this.toastMessage = ""; }, 1800);
  }

  downloadGameData() {
    downloadTextFile("gamedata.txt", generateGameData(this.cartData));
    this.showToast("gamedata.txt downloaded");
  }

  handleKeydown(event) {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      this.querySelector("#search-input")?.focus();
    }
    if (event.key === "Escape" && this.cartOpen) this.cartOpen = false;
  }

  renderHeader() {
    return html`
      <a class="skip-link" href="#catalog">Skip to catalog</a>
      <header class="site-header">
        <a class="brand" href="./" aria-label="SigShop home">
          <span class="brand-mark" aria-hidden="true"><span>S</span></span>
          <span class="brand-copy"><strong>SigShop</strong><small>SourceMod gamedata</small></span>
        </a>
        <nav class="header-actions" aria-label="Primary navigation">
          <a class="text-link" href="#about">How it works</a>
          <button class="cart-button" type="button" aria-controls="cart-drawer" aria-expanded=${String(this.cartOpen)} @click=${() => { this.cartOpen = true; }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 5.5h15.3l-1.7 8.1a2 2 0 0 1-2 1.6H8.4a2 2 0 0 1-2-1.6L4.7 3H2V1.5h4l.5 2.5h14.9a.8.8 0 0 1 .8 1l-2 9a3.5 3.5 0 0 1-3.4 2.7H8.4A3.5 3.5 0 0 1 5 14L3.5 3H2V1.5h3.9l-.7 4Zm4.1 15.7a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Zm10 0a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0Z"></path></svg>
            <span>Gamedata cart</span><span class="cart-count" aria-label=${`${this.cartData.length} items`}>${this.cartData.length}</span>
          </button>
        </nav>
      </header>
    `;
  }

  renderHero() {
    return html`
      <section class=${`hero ${this.query ? "compact" : ""}`} aria-labelledby="hero-title">
        <div class="eyebrow"><span class="live-dot"></span> Community-maintained function catalog</div>
        <h1 id="hero-title">Gamedata, <em>off the shelf.</em></h1>
        <p>Find the function you need, inspect its signatures and offsets, then pack a custom gamedata file in a few clicks.</p>
        <div class="hero-controls">
          <label class="game-picker">
            <span>Game</span>
            <select aria-label="Select a game" .value=${this.currentGameId} @change=${(event) => this.selectGame(event.target.value)}>
              ${this.manifest.map((game) => html`<option value=${game.id}>${game.title}</option>`)}
            </select>
          </label>
          <label class="search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 20-5.2-5.2a7.8 7.8 0 1 0-1 1L20 21l1-1ZM4.5 10a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"></path></svg>
            <span class="sr-only">Search functions</span>
            <input id="search-input" type="search" placeholder="Search function, class, member…" autocomplete="off" .value=${this.query} @input=${(event) => { this.query = event.target.value; }} />
            <kbd>/</kbd>
          </label>
        </div>
      </section>
    `;
  }

  renderFilters() {
    const entries = this.dataset?.entries || [];
    return html`
      <aside class="filter-panel">
        <div class="filter-heading"><span>Browse by scope</span><button class="subtle-button" type="button" @click=${this.resetFilters}>Reset</button></div>
        <label class="scope-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 20-5.2-5.2a7.8 7.8 0 1 0-1 1L20 21l1-1ZM4.5 10a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"></path></svg>
          <span class="sr-only">Filter classes and scopes</span>
          <input type="search" placeholder="Filter classes…" autocomplete="off" .value=${this.scopeQuery} @input=${(event) => { this.scopeQuery = event.target.value; }} />
        </label>
        <nav class="scope-filters" aria-label="Function scopes">
          <button class=${`scope-button ${this.scope === "all" ? "active" : ""}`} type="button" @click=${() => { this.scope = "all"; }}><span>All entries</span><span>${entries.length}</span></button>
          ${this.visibleScopes.map(([scope, count]) => html`<button class=${`scope-button ${this.scope === scope ? "active" : ""}`} type="button" title=${scope} @click=${() => { this.scope = scope; }}><span>${scope}</span><span>${count}</span></button>`)}
          ${this.visibleScopes.length ? nothing : html`<span class="scope-empty">No matching classes</span>`}
        </nav>
        <div class="filter-group">
          <span class="filter-label">Available data</span>
          <label class="check-row"><input type="checkbox" .checked=${this.kinds.has("signature")} @change=${(event) => this.toggleKind("signature", event.target.checked)} /><span>Signatures</span><span class="filter-count">${entries.filter((entry) => entry.signature).length}</span></label>
          <label class="check-row"><input type="checkbox" .checked=${this.kinds.has("vtable")} @change=${(event) => this.toggleKind("vtable", event.target.checked)} /><span>Vtable offsets</span><span class="filter-count">${entries.filter((entry) => entry.offset?.kind === "vtable").length}</span></label>
          <label class="check-row"><input type="checkbox" .checked=${this.kinds.has("member")} @change=${(event) => this.toggleKind("member", event.target.checked)} /><span>Data members</span><span class="filter-count">${entries.filter((entry) => entry.offset?.kind === "member").length}</span></label>
          <label class="check-row"><input type="checkbox" .checked=${this.verifiedOnly} @change=${(event) => { this.verifiedOnly = event.target.checked; }} /><span>Verified only</span><span class="filter-count">${entries.filter((entry) => this.entryIsVerified(entry)).length}</span></label>
        </div>
      </aside>
    `;
  }

  renderActiveFilters() {
    const filters = [];
    if (this.query) filters.push([`Search: ${this.query}`, "query"]);
    if (this.scope !== "all") filters.push([this.scope, "scope"]);
    for (const kind of this.kinds) {
      const labels = { signature: "Has signature", vtable: "Vtable offset", member: "Data member" };
      filters.push([labels[kind], `kind:${kind}`]);
    }
    if (this.verifiedOnly) filters.push(["Verified", "verified"]);
    return html`<div class="active-filters" aria-live="polite">${filters.map(([label, key]) => html`<span class="filter-chip">${label}<button type="button" aria-label=${`Remove ${label} filter`} @click=${() => this.removeFilter(key)}>×</button></span>`)}</div>`;
  }

  renderCatalog() {
    const entries = this.filteredEntries;
    return html`
      <section class="catalog-shell" id="catalog" aria-label="Signature catalog">
        ${this.renderFilters()}
        <div class="catalog-content">
          <div class="catalog-toolbar">
            <div>
              <div class="breadcrumb">${this.dataset?.game.title} / ${this.scope === "all" ? "All entries" : this.scope}</div>
              <h2><span>${entries.length}</span> entries in stock</h2>
              <div class="version-row">
                <span class="version-summary">Current build ${getCurrentVersion(this.gameDescriptor) || "unknown"} · ${(this.dataset?.entries || []).filter((entry) => this.entryIsVerified(entry)).length}/${this.dataset?.entries.length || 0} verified</span>
                <span class="verification-legend" aria-label="Verification status legend"><span><i class="status-dot verified"></i> Current</span><span><i class="status-dot"></i> Check needed</span></span>
              </div>
            </div>
            <label class="sort-control"><span>Sort</span><select .value=${this.sort} @change=${(event) => { this.sort = event.target.value; }}><option value="name">Name A–Z</option><option value="updated">Recently updated</option><option value="scope">Class / scope</option></select></label>
          </div>
          ${this.renderActiveFilters()}
          ${entries.length ? html`
            <div class="function-grid" aria-live="polite">
              ${entries.map((entry) => html`<sig-function-card
                .entry=${entry}
                .game=${this.dataset.game}
                .inCart=${this.isInCart(entry.id)}
                .verified=${this.entryIsVerified(entry)}
                .testedVersion=${getTestedVersion(entry, this.dataset)}
                .currentVersion=${getCurrentVersion(this.gameDescriptor)}
                @view-entry=${(event) => this.showDetail(event.detail.entryId)}
                @toggle-cart=${(event) => this.toggleCart(event.detail.entryId)}
              ></sig-function-card>`)}
            </div>
          ` : html`
            <div class="empty-state"><div class="empty-icon">∅</div><h3>Nothing on this shelf</h3><p>Try a broader search or clear your filters.</p><button class="secondary-button" type="button" @click=${this.resetFilters}>Clear filters</button></div>
          `}
        </div>
      </section>
    `;
  }

  renderDetail() {
    const entry = this.detailEntry;
    if (!entry) return nothing;
    const rows = [];
    for (const [platform, value] of Object.entries(entry.signature?.values || {})) rows.push([`Signature · ${platform}`, value]);
    for (const [platform, value] of Object.entries(entry.offset?.values || {})) rows.push([`Offset · ${platform}`, value]);
    const inCart = this.isInCart(entry.id);
    const kindLabel = entry.category === "member" ? "Data member" : entry.offset?.kind === "vtable" && !entry.signature ? "Vtable function" : "Function";
    const sourceLinks = entry.sources?.length ? entry.sources : [entry.provider].filter(Boolean);
    const testedVersion = getTestedVersion(entry, this.dataset);
    const currentVersion = getCurrentVersion(this.gameDescriptor);
    const verified = this.entryIsVerified(entry);
    return html`
      <dialog class="detail-dialog" id="detail-dialog" aria-labelledby="detail-title" @close=${() => { this.detailId = null; }}>
        <div class="dialog-header">
          <div><span class="scope-tag">${this.dataset.game.title} · ${entry.scopeType === "global" ? "Global" : entry.scope}</span><h2 id="detail-title">${entry.name}</h2></div>
          <button class="icon-button" type="button" aria-label="Close details" @click=${this.closeDetail}>×</button>
        </div>
        <div class="dialog-body">
          <p class="detail-lede">${entry.description}</p>
          <div class="detail-meta"><div><span>Type</span><strong>${kindLabel}</strong></div><div><span>Library</span><strong>${entry.signature?.library || "—"}</strong></div><div><span>Tested build</span><strong>${testedVersion || "Unknown"}</strong></div><div><span>Current build</span><strong>${currentVersion || "Unknown"}</strong></div><div><span>Status</span><strong>${verified ? "Verified" : "Needs verification"}</strong></div></div>
          <section class="detail-section"><h3>Gamedata values</h3><div class="platform-table">${rows.map(([label, value]) => html`<div class="platform-row"><span>${label}</span><code>${value}</code><button class="copy-button" type="button" aria-label=${`Copy ${label}`} @click=${() => this.copyValue(value)}>⧉</button></div>`)}</div></section>
          ${entry.functionConfig ? html`<section class="detail-section"><h3>Gameconf call definition</h3><sig-call-definition .functionName=${entry.name} .config=${entry.functionConfig}></sig-call-definition></section>` : nothing}
          ${entry.notes ? html`<section class="detail-section"><h3>Notes</h3><div class="notes-box">${entry.notes}</div></section>` : nothing}
          ${Object.entries(entry.usage || {}).map(([kind, code]) => html`<section class="detail-section"><h3>${kind} example</h3><pre class="code-block"><code>${code}</code></pre></section>`)}
          <div class="dialog-footer"><div class="provider-detail">Source${sourceLinks.length === 1 ? "" : "s"}: ${sourceLinks.map((source, index) => html`${index ? ", " : nothing}${safeUrl(source.url) ? html`<a href=${safeUrl(source.url)} target="_blank" rel="noreferrer">${source.name}</a>` : html`<strong>${source.name}</strong>`}`)}</div><button class=${`detail-add ${inCart ? "in-cart" : ""}`} type="button" @click=${() => this.toggleCart(entry.id)}>${inCart ? "✓ Added to cart" : "+ Add to gamedata cart"}</button></div>
        </div>
      </dialog>
    `;
  }

  renderAbout() {
    return html`
      <section class="about" id="about" aria-labelledby="about-title"><div><span class="section-number">01 — HOW IT WORKS</span><h2 id="about-title">From function to config,<br />without the scavenger hunt.</h2></div><ol class="steps"><li><span>01</span><div><strong>Pick your game</strong><p>Browse functions and data members by class or global scope.</p></div></li><li><span>02</span><div><strong>Inspect the stock</strong><p>Review platform values, provenance, notes, and call definitions.</p></div></li><li><span>03</span><div><strong>Pack your gamedata</strong><p>Add only what you need and download valid SourceMod KeyValues.</p></div></li></ol></section>
    `;
  }

  render() {
    if (this.loadError) return html`${this.renderHeader()}<main><section class="hero"><h1>Catalog unavailable.</h1><p>${this.loadError} Check the static data files and try again.</p></section></main>`;
    if (this.loading && !this.dataset) return html`${this.renderHeader()}<main><section class="hero"><div class="eyebrow"><span class="live-dot"></span>Loading catalog</div><h1>Stocking the shelves…</h1></section></main>`;
    return html`
      ${this.renderHeader()}
      <main>${this.renderHero()}${this.renderCatalog()}${this.renderAbout()}</main>
      <footer><div class="brand footer-brand"><span class="brand-mark" aria-hidden="true"><span>S</span></span><span class="brand-copy"><strong>SigShop</strong><small>Built for the SourceMod community.</small></span></div><p>Signatures may break after game updates. Check verification dates before deploying.</p></footer>
      ${this.renderDetail()}
      <sig-cart-drawer .items=${this.cartData} .open=${this.cartOpen} @close-cart=${() => { this.cartOpen = false; }} @remove-cart-item=${(event) => { const key = `${event.detail.gameId}:${event.detail.entryId}`; this.cart = this.cart.filter((item) => item.key !== key); this.persistCart(); }} @clear-cart=${() => { this.cart = []; this.persistCart(); }} @download-gamedata=${this.downloadGameData}></sig-cart-drawer>
      <div class=${`toast ${this.toastMessage ? "show" : ""}`} role="status" aria-live="polite">${this.toastMessage}</div>
    `;
  }
}

customElements.define("sig-shop-app", SigShopApp);
