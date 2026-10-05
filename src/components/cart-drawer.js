import { LitElement, html } from "lit";

export class CartDrawer extends LitElement {
  static properties = {
    items: { attribute: false },
    open: { type: Boolean, reflect: true },
  };

  constructor() {
    super();
    this.items = [];
    this.open = false;
  }

  createRenderRoot() {
    return this;
  }

  emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  render() {
    const count = this.items.length;
    return html`
      <div class="drawer-backdrop" ?hidden=${!this.open} @click=${() => this.emit("close-cart")}></div>
      <aside class=${`cart-drawer ${this.open ? "open" : ""}`} aria-labelledby="cart-title" aria-hidden=${String(!this.open)}>
        <div class="drawer-header">
          <div><span class="eyebrow-small">YOUR SELECTION</span><h2 id="cart-title">Gamedata cart</h2></div>
          <button class="icon-button" type="button" aria-label="Close cart" @click=${() => this.emit("close-cart")}>×</button>
        </div>

        ${count ? html`
          <div class="cart-items">
            ${this.items.map(({ game, entry }) => html`
              <div class="cart-item">
                <div>
                  <small>${game.title} · ${entry.scopeType === "global" ? "Global" : entry.scope}</small>
                  <strong>${entry.gamedataKey || entry.name}</strong>
                  <div class="data-badges">
                    ${entry.signature ? html`<span class="data-badge">Signature</span>` : null}
                    ${entry.offset ? html`<span class="data-badge offset">${entry.offset.kind === "member" ? "Member" : "Vtable"}</span>` : null}
                    ${entry.functionConfig ? html`<span class="data-badge callable">Callable</span>` : null}
                  </div>
                </div>
                <button class="remove-item" type="button" aria-label=${`Remove ${entry.name}`} @click=${() => this.emit("remove-cart-item", { gameId: game.id, entryId: entry.id })}>×</button>
              </div>
            `)}
          </div>
        ` : html`
          <div class="cart-empty">
            <div class="empty-cart-art" aria-hidden="true">{ }</div>
            <strong>Your cart is empty</strong>
            <p>Add a function to start building a custom gamedata file.</p>
          </div>
        `}

        <div class="drawer-footer">
          <div class="file-summary"><span>Output</span><strong>${count} ${count === 1 ? "entry" : "entries"} · gamedata.txt</strong></div>
          <button class="download-button" type="button" ?disabled=${!count} @click=${() => this.emit("download-gamedata")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.25 3h1.5v10.1l3.6-3.6 1.05 1.06L12 15.96l-5.4-5.4L7.65 9.5l3.6 3.6V3ZM4 18h16v3H4v-3Z"></path></svg>
            Download gamedata.txt
          </button>
          <button class="clear-cart-button" type="button" ?disabled=${!count} @click=${() => this.emit("clear-cart")}>Clear cart</button>
        </div>
      </aside>
    `;
  }
}

customElements.define("sig-cart-drawer", CartDrawer);
