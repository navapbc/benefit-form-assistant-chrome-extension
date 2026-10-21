// The welcome page: what the assistant does, and the safeguards that keep the caseworker in control.
// Shown once per browser session on load, and reachable from the start screen's "How this works" link.

/**
 * deps:
 * - appRoot: the screen root.
 */
function create(deps) {
  const { appRoot } = deps;

  function renderWelcome() {
    appRoot.innerHTML = `
    <section>
      <div class="intro">
        <p class="eyebrow">Welcome</p>
        <h1>Apply for benefits with less typing</h1>
        <p class="lede">Find your client, pick an application, and the assistant fills it in from their information. You check everything before it is sent.</p>
      </div>

      <h2 class="section-title">How it works</h2>
      <ol class="steps">
        <li><span class="step-number" aria-hidden="true">1</span><span><strong>Find your client.</strong> Search the participant directory, type in their details, or upload a document.</span></li>
        <li><span class="step-number" aria-hidden="true">2</span><span><strong>Choose the application.</strong> The assistant fills it in right in your browser, one page at a time.</span></li>
        <li><span class="step-number" aria-hidden="true">3</span><span><strong>Review and submit.</strong> Anything it could not answer comes back to you as a question. You press submit. The assistant never does.</span></li>
      </ol>

      <h2 class="section-title">What keeps you in control</h2>
      <ul class="safeguards">
        <li><strong>You always submit.</strong> The assistant stops at the final review and waits for you.</li>
        <li><strong>No guessing.</strong> If an answer is not in the client’s information, it asks you instead of making one up.</li>
        <li><strong>Client details stay in this browser.</strong> They are held for this session only and are left out of what is sent to AI models.</li>
        <li><strong>Searching shares very little.</strong> The directory receives the name or ID you type, and nothing else.</li>
        <li><strong>Every step is recorded.</strong> You can export a log of what the assistant did.</li>
      </ul>

      <div class="form-actions">
        <button class="primary-button" type="button" data-action="dismiss-welcome">Get started</button>
      </div>
    </section>`;
  }

  return { renderWelcome };
}

export { create };
