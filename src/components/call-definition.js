import { LitElement, html, nothing } from "lit";

export class CallDefinition extends LitElement {
  static properties = {
    functionName: { type: String },
    config: { attribute: false },
  };

  constructor() {
    super();
    this.functionName = "";
    this.config = {};
  }

  createRenderRoot() {
    return this;
  }

  render() {
    const config = this.config || {};
    const argumentsList = Object.entries(config.arguments || {});
    const usesOffset = Boolean(config.offset);
    const reference = config.signature || config.offset || "Unspecified";
    const displayName = this.functionName.replace(/\(\)$/, "");

    return html`
      <div class="call-definition-card">
        <div class="call-definition-header">
          <span class=${`call-kind ${usesOffset ? "offset" : ""}`}>${usesOffset ? "Vtable hook" : "Signature call"}</span>
          <code title=${reference}>${reference}</code>
        </div>

        <div class="call-prototype" aria-label="Function declaration">
          <span class="return-type">${config.return || "void"}</span>
          <strong>${displayName}</strong><span class="paren">(</span>
        </div>

        ${argumentsList.length ? html`
          <ol class="argument-list">
            ${argumentsList.map(([name, definition], index) => html`
              <li>
                <span class="argument-index">${String(index + 1).padStart(2, "0")}</span>
                <code class="argument-type">${definition.type || "unknown"}</code>
                <strong>${name}</strong>
                ${Object.entries(definition).filter(([key]) => key !== "type").map(([key, value]) => html`<span class="argument-trait">${key}: ${value}</span>`)}
              </li>
            `)}
          </ol>
        ` : html`<div class="no-arguments"><code>void</code><span>No explicit arguments</span></div>`}

        <div class="call-close" aria-hidden="true">)</div>
        <dl class="call-traits">
          ${config.callconv ? html`<div><dt>Calling convention</dt><dd>${config.callconv}</dd></div>` : nothing}
          ${config.hooktype ? html`<div><dt>Hook type</dt><dd>${config.hooktype}</dd></div>` : nothing}
          <div><dt>This pointer</dt><dd>${config.this || "not specified"}</dd></div>
          <div><dt>Return type</dt><dd>${config.return || "void"}</dd></div>
        </dl>
      </div>
    `;
  }
}

customElements.define("sig-call-definition", CallDefinition);
