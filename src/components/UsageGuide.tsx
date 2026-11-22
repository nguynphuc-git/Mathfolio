export function UsageGuide({onStart}:{onStart:()=>void}) {
  return <section className="usage-guide" aria-labelledby="guide-title">
    <div className="page-heading">
      <h1 id="guide-title">How to use Mathfolio</h1>
      <button className="primary" onClick={onStart}>Go to workspace</button>
    </div>
    <div className="guide-grid">
      <article className="paper">
        <h2>Bring your problem</h2>
        <p>Type or paste a problem, or import one from a PDF or image. Check the formulas and add a sketch if it helps.</p>
      </article>
      <article className="paper">
        <h2>Choose a hint</h2>
        <p>Select <strong>Confirm &amp; analyze</strong> to see the concepts you need. You can open any hint. For a gradual start, try the starting point, then the method, then the full solution.</p>
      </article>
      <article className="paper">
        <h2>Work through it</h2>
        <p>Use chat to ask a question. Keep your reasoning and sketches in <strong>Your working notes</strong>, or turn on <strong>Focus mode</strong> to work on your own.</p>
      </article>
      <article className="paper">
        <h2>Save and revisit</h2>
        <p>Choose <strong>Save exercise</strong> to keep your work in the <strong>Exercise library</strong>. Return there to continue or mark it completed.</p>
      </article>
    </div>
    <section className="paper guide-details" aria-labelledby="guide-ai">
      <h2 id="guide-ai">AI and storage</h2>
      <p>Local AI runs on supported devices. If you enable Cloud AI, your problem and selected images can be sent with your request. Your working notes stay private.</p>
      <p>Your notebook is saved in this browser for your account. Clearing browser data can erase it.</p>
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
