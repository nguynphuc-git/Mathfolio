export function UsageGuide({onStart}:{onStart:()=>void}) {
  return <section className="usage-guide" aria-labelledby="guide-title">
    <div className="page-heading">
      <h1 id="guide-title">How to use Mathfolio</h1>
      <button className="primary" onClick={onStart}>Go to workspace</button>
    </div>
    <div className="guide-grid">
      <article className="paper">
        <h2>Bring your problem</h2>
        <p>Type in <strong>Problem</strong>, switch between <strong>Math</strong> and <strong>Text</strong>, or paste text and LaTeX. Use the symbol buttons to add formulas.</p>
        <p>Inside the Problem editor, choose <strong>Read PDF</strong> to select questions across pages, or <strong>Read image</strong> to extract a photographed problem. Review and correct the formulas before using the result.</p>
      </article>
      <article className="paper">
        <h2>Choose your help</h2>
        <p>Select <strong>Confirm &amp; analyze</strong> to see the concepts needed for your problem. Choose Local AI or Cloud AI for the analysis.</p>
        <p>Open any hint you need. We recommend trying level 1 for a starting point, level 2 for the method, then level 3 for the full solution. Use <strong>Reset hints</strong> to generate fresh hints.</p>
      </article>
      <article className="paper">
        <h2>Work through it</h2>
        <p>In <strong>Illustrations</strong>, draw a figure or add an image. Ask questions in chat and attach a sketch to your next message. Keep your reasoning and solution images in <strong>Your working notes</strong>.</p>
        <p>Turn on <strong>Solo mode</strong> to work with your problem, illustrations and notes. Images added there stay outside AI context. Choose <strong>Exit solo</strong> to return to hints and chat.</p>
      </article>
      <article className="paper">
        <h2>Save and revisit</h2>
        <p>Choose <strong>Save exercise</strong> to name your work and place it in folders. Autosave keeps a workspace draft; save the exercise to update its library copy.</p>
        <p>In <strong>Exercise library</strong>, search your saved work or mark it completed. Open a preview to read the page and edit notes, then choose <strong>Open in workspace</strong> to continue the exercise.</p>
      </article>
    </div>
    <section className="paper guide-details" aria-labelledby="guide-ai">
      <h2 id="guide-ai">AI and storage</h2>
      <p>Local AI needs a supported device and a downloaded model. Cloud AI needs internet access and your permission to send the problem and selected images. Check AI answers against your source and calculations.</p>
      <p>Your notebook is saved in this browser. In <strong>Account</strong>, enable <strong>Cloud sync</strong> on each device to sync saved exercises, folders, notes, chat and images. Offline saves wait for a connection; conflicting edits are kept as a copy. Workspace drafts stay on their device. Cloud sync is separate from Cloud AI.</p>
      <p>Open Mathfolio online first and let it finish loading to prepare for offline use. Check that cloud sync is up to date before relying on another device; clearing browser data can erase work that has not synced.</p>
    </section>
    <details className="paper guide-details">
      <summary>Keyboard shortcuts</summary>
      <dl>
        <dt>Ctrl / ⌘ + S</dt><dd>Save your work.</dd>
        <dt>Ctrl / ⌘ + Enter</dt><dd>Analyze the problem or send a chat message.</dd>
        <dt>Alt / Option</dt><dd>Switch between Math and Text.</dd>
        <dt>Escape</dt><dd>Close a viewer or dialog.</dd>
      </dl>
    </details>
  </section>;
}
