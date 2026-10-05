import { LitElement, html } from "lit";

export class FunctionCard extends LitElement {
  static properties = {
    entry: { attribute: false },
    game: { attribute: false },
    inCart: { type: Boolean },
    verified: { type: Boolean },
    testedVersion: { type: String },
    currentVersion: { type: String },
  };

  createRenderRoot() {
    return this;
  }

  emit(name) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      composed: true,
      detail: { entryId: this.entry.id },
    }));
  }

  openDetails() {
    this.emit("view-entry");
  }

  toggleCart(event) {
    // Keep the cart action independent from the card's details action.
    this.emit("toggle-cart");
  }

  render() {
    const entry = this.entry;
    if (!entry) return null;
    const scope = entry.scopeType === "global" ? "Global" : entry.scope;
    const offsetLabel = entry.offset?.kind === "member" ? "Data member" : "Vtable offset";

    return html`
      <article class="function-card" style=${`--card-accent:${this.game?.accent || "#c8f45a"}`}>
        <button class="card-open" type="button" aria-label=${`View details for ${entry.name}`} @click=${this.openDetails}></button>
        <div class="card-top">
          <span class="scope-tag">${scope}</span>
          <span
            class=${`status-dot ${this.verified ? "verified" : ""}`}
            role="img"
            aria-label=${this.verified ? "Verified for the current game version" : "Needs verification"}
            title=${this.verified
              ? `Tested for current game version ${this.currentVersion}`
              : `Needs verification (tested ${this.testedVersion || "unknown"}, current ${this.currentVersion || "unknown"})`}
          ></span>
        </div>
        <h3>${entry.name}</h3>
        <p>${entry.description}</p>
        <div class="data-badges">
          ${entry.signature ? html`<span class="data-badge">Signature</span>` : null}
          ${entry.offset ? html`<span class="data-badge offset">${offsetLabel}</span>` : null}
        </div>
        <div class="provider-line">
          <span>Provided by <strong>${entry.provider?.name || "Unknown"}</strong></span>
          <span>${entry.updated || "—"}</span>
        </div>
        <div class="card-actions">
          <button
            class=${`add-button ${this.inCart ? "in-cart" : ""}`}
            type="button"
            aria-label=${`${this.inCart ? "Remove from" : "Add to"} gamedata cart`}
            title=${this.inCart ? "Remove from gamedata cart" : "Add to gamedata cart"}
            @click=${this.toggleCart}
          >${this.inCart ? "✓" : "+"}</button>
        </div>
      </article>
    `;
  }
}

customElements.define("sig-function-card", FunctionCard);
