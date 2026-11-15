// @vitest-environment happy-dom
import { act, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotebookRequest } from '../src/ai';
import type { Answer, Notebook } from '../src/notebook';

const mocks = vi.hoisted(() => ({ values: new Map<string, Notebook>(), ai: vi.fn(), write: vi.fn() }));
vi.mock('idb-keyval', () => ({ get: vi.fn(async (key: string) => structuredClone(mocks.values.get(key))), set: async (key: string, value: Notebook) => { mocks.write(key, value); mocks.values.set(key, structuredClone(value)); } }));
vi.mock('../src/firebase', () => ({ getFirebaseApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ app: { options: { projectId: 'test' } } }),
  onAuthStateChanged: (_: unknown, callback: (value: unknown) => void) => { callback({ uid: 'alice', email: 'alice@example.test' }); return () => {}; },
  createUserWithEmailAndPassword: vi.fn(), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn()
}));
vi.mock('../src/ai', () => ({ notebookAI: mocks.ai, friendlyError: (error: Error) => error.message }));
// MathLive caret/layout is tested manually in Chrome; these tests exercise page state and persistence.
vi.mock('../src/components/MathInput', () => ({ MathInput: forwardRef(function Field(props: { value: string; onChange?: (value: string) => void; readOnly?: boolean; disabled?: boolean; label?: string }, ref) {
  useImperativeHandle(ref, () => ({ focus() {}, insert() {} }));
  return <textarea aria-label={props.label ?? 'Problem statement'} readOnly={props.readOnly} disabled={props.disabled} value={props.value} onChange={event => props.onChange?.(event.target.value)}/>;
}) }));
import App from '../src/App';
import { emptyNotebook, newExercise, notebookKey } from '../src/notebook';

let root: Root; let host: HTMLDivElement;
const storageKey = notebookKey('test', 'alice');
function stored() { return mocks.values.get(storageKey)!; }
function button(text: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(value => value.textContent?.trim().startsWith(text));
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
async function click(text: string, scope?: ParentNode) { await act(async () => { button(text, scope).click(); }); }
async function type(selector: string, value: string) {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function library() { await click('Exercise library'); await click('▱'); }
async function openWorkspace() { await library(); await click('Open exercise'); await click('Open in workspace'); }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mocks.ai.mockReset(); mocks.write.mockReset(); mocks.values.clear();
  const first = { ...newExercise(), id: 'first', title: 'Quadratic page', statement: 'x^2+2x=0', confirmed: true, notes: 'Original notes', knowledge: { text: 'Original essentials', source: 'local_reference' }, hints: [{ text: 'Original hint', source: 'on_device' }], messages: [{ role: 'user' as const, text: 'Original question' }], attachments: [{ id: 'image', name: 'solution.png', data: 'data:image/png;base64,AA==', kind: 'solution' as const }] };
  mocks.values.set(storageKey, { ...emptyNotebook(), exercises: [first, { ...newExercise(), id: 'second', title: 'Second page', statement: 'x=1', confirmed: true }] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<App/>); });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('saved page previews and workspace copies', () => {
  it('saves and restores an unanalyzed problem without calling AI', async () => {
    expect(button('Save exercise').disabled).toBe(true);
    await type('[aria-label="Problem statement"]', 'Prove the theorem');
    await type('[aria-label="Notes"]', 'Try induction');
    await click('Save exercise');
    await type('.save-dialog input', 'Induction');
    await click('Save on this device');
    const saved = stored().exercises[0];
    expect(saved).toMatchObject({ title: 'Induction', confirmed: false, notes: 'Try induction' });
    await click('＋ New exercise');
    await openWorkspace();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe(saved.statement);
    expect(button('Confirm & analyze').disabled).toBe(false);
    expect(mocks.ai).not.toHaveBeenCalled();
  });

  it('opens all saved content in a dismissible preview; only notes can be edited', async () => {
    await library(); await click('Open exercise');
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Original essentials'); expect(dialog.textContent).toContain('Original hint');
    expect(dialog.textContent).toContain('Original question'); expect(dialog.textContent).toContain('solution.png');
    expect(dialog.querySelector<HTMLTextAreaElement>('[aria-label="Saved problem"]')!.readOnly).toBe(true);
    expect(dialog.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.readOnly).toBe(false);
    await click('Close', dialog);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await click('Open exercise', host.querySelectorAll('.exercise-card')[1]);
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('Second page');
    expect(mocks.ai).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
  it('saves only preview notes, retaining problem, hints, chat and attachments', async () => {
    const original = structuredClone(stored().exercises[0]);
    await library(); await click('Open exercise');
    await type('[aria-label="Saved exercise notes"]', 'Updated in preview');
    expect(button('Save notes').disabled).toBe(false);
    await click('Save notes');
    const { notes, updatedAt, ...other } = stored().exercises[0];
    const { notes: _, updatedAt: __, ...before } = original;
    expect(notes).toBe('Updated in preview'); expect(other).toEqual(before);
    await click('Close', host.querySelector('[role="dialog"]')!);
    await click('Open exercise');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe('Updated in preview');
  });
  it('protects unsaved preview notes when closing with Escape', async () => {
    await library(); await click('Open exercise');
    await type('[aria-label="Saved exercise notes"]', 'Unsaved preview');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    await click('Keep working');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe('Unsaved preview');
    await click('Close', host.querySelector('[role="dialog"]')!); await click('Discard notes & continue');
    expect(stored().exercises[0].notes).toBe('Original notes');
  });
  it('keeps the edited notes and original saved page when storage fails, then allows retry', async () => {
    await library(); await click('Open exercise');
    await type('[aria-label="Saved exercise notes"]', 'Notes to retry');
    mocks.write.mockImplementationOnce(() => { throw new Error('Storage is full'); });
    await click('Save notes');
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('Storage is full');
    expect(stored().exercises[0].notes).toBe('Original notes');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe('Notes to retry');
    expect(button('Save notes').disabled).toBe(false);
    await click('Save notes'); expect(stored().exercises[0].notes).toBe('Notes to retry');
  });
  it('keeps workspace edits out of the saved page until Save overwrites the same exercise', async () => {
    await openWorkspace(); await type('[aria-label="Notes"]', 'Uncommitted workspace');
    await click('Exercise library'); await click('Open exercise');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe('Original notes');
    await click('Close', host.querySelector('[role="dialog"]')!); await click('Workspace');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('Uncommitted workspace');
    await click('Save exercise');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(stored().exercises).toHaveLength(2); expect(stored().exercises[0].id).toBe('first');
    expect(stored().exercises[0].notes).toBe('Uncommitted workspace');
  });
  it('discards a workspace copy only after confirmation when opening another saved page', async () => {
    await openWorkspace(); await type('[aria-label="Notes"]', 'Discard this draft');
    await click('Exercise library');
    await click('Open exercise', host.querySelectorAll('.exercise-card')[1]);
    await click('Open in workspace');
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    await click('Keep working'); expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    await click('Open in workspace'); await click('Discard & open');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector('h1')!.textContent).toBe('Second page');
    expect(stored().exercises[0].notes).toBe('Original notes');
    expect(mocks.write).not.toHaveBeenCalled();
  });
});

describe('Stop AI restores the pre-request page', () => {
  it.each(['knowledge', 'hint1', 'hint2', 'hint3', 'chat'] as NotebookRequest['purpose'][])('stops %s, drops partial/late output and allows a fresh request', async purpose => {
    const book = stored();
    if (purpose === 'hint1') book.exercises[0].hints = [];
    if (purpose === 'hint3') book.exercises[0].hints.push({ text:'Previous second hint', source:'in_cloud' });
    // Rerender with a newly loaded page so the fixture changes are visible to the app.
    await act(async () => root.unmount()); root = createRoot(host);
    await act(async () => { root.render(<App/>); });
    await openWorkspace();
    const before = structuredClone(stored());
    const calls: { text: (text: string) => void; resolve: (answer: Answer) => void; signal: AbortSignal }[] = [];
    mocks.ai.mockImplementation((_: NotebookRequest, text: (text: string) => void, signal: AbortSignal) => new Promise<Answer>(resolve => calls.push({ text, resolve, signal })));
    if (purpose === 'hint2' || purpose === 'hint3') { await click('Cloud AI'); await click('Allow Cloud AI'); }
    if (purpose === 'chat') await type('[aria-label="Discussion question"]', 'Keep this question');
    const trigger = purpose === 'knowledge' ? 'Refresh knowledge' : purpose === 'chat' ? 'Send' : `Open level ${purpose.slice(-1)}`;
    await click(trigger);
    await act(async () => calls[0].text('PARTIAL THAT MUST DISAPPEAR'));
    expect(host.textContent).toContain('PARTIAL THAT MUST DISAPPEAR');
    await click('■ Stop AI');
    expect(calls[0].signal.aborted).toBe(true); expect(host.textContent).not.toContain('PARTIAL THAT MUST DISAPPEAR');
    expect(stored()).toEqual(before); expect(button('Save exercise').textContent).not.toContain('•');
    if (purpose === 'chat') expect(host.querySelector<HTMLInputElement>('[aria-label="Discussion question"]')!.value).toBe('Keep this question');
    await click(trigger);
    await act(async () => { calls[0].text('STALE'); calls[0].resolve({ text:'STALE', source:'on_device' }); });
    expect(host.textContent).not.toContain('STALE'); expect(host.querySelector('.ai-toolbar')).not.toBeNull();
    await act(async () => calls[1].resolve({ text:'Fresh answer', source:'on_device' }));
    expect(host.textContent).toContain('Fresh answer'); expect(host.querySelector('.ai-toolbar')).toBeNull();
    expect(stored()).toEqual(before);
  });
  it('does not confirm or save an unconfirmed problem when analysis is stopped', async () => {
    await type('[aria-label="Problem statement"]', 'A new problem');
    mocks.ai.mockImplementation(() => new Promise(() => {}));
    await click('Confirm & analyze');
    expect(host.querySelector('[role="alertdialog"]')!.textContent).toContain('Cloud AI will receive the problem statement');
    await click('Allow Cloud AI'); await click('■ Stop AI');
    expect(button('Confirm & analyze').disabled).toBe(false);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.readOnly).toBe(false);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('uses the local formula reference for recognized equations without cloud consent', async () => {
    await type('[aria-label="Problem statement"]', 'x^2-5x+6=0');
    mocks.ai.mockResolvedValue({text:'Quadratic formula',source:'local_reference'});
    await click('Confirm & analyze');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'knowledge',route:'local',cloudAllowed:false});
  });
});

describe('Cloud AI permission and chat controls', () => {
  it('asks before cloud hint 2, cancels without running AI, then enables and runs only after consent', async () => {
    await openWorkspace(); mocks.ai.mockResolvedValue({text:'Allowed cloud hint',source:'in_cloud'});
    expect(host.querySelector('.hints input[type="checkbox"]')).toBeNull();
    await click('Open level 2');
    expect(host.querySelector('[role="alertdialog"]')!.textContent).toContain('Allow Cloud AI?');
    expect(mocks.ai).not.toHaveBeenCalled();
    await click('Not now'); expect(mocks.ai).not.toHaveBeenCalled();
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
    await click('Open level 2'); await click('Allow Cloud AI');
    expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint2',cloudAllowed:true});
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    expect(host.textContent).toContain('Allowed cloud hint');
    await click('Cloud AI', host.querySelector('.workspace-actions')!);
    await click('Open level 3');
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(mocks.ai).toHaveBeenCalledTimes(1);
  });
  it('syncs left/right chat selection with the switch, and never treats denial as consent', async () => {
    await openWorkspace();
    const routes = host.querySelector('[aria-label="Chat processing"]')!;
    expect(button('Local AI',routes).getAttribute('aria-pressed')).toBe('true');
    await click('Cloud AI',routes); await click('Not now');
    expect(button('Local AI',routes).getAttribute('aria-pressed')).toBe('true');
    expect(button('Cloud AI',routes).getAttribute('aria-pressed')).toBe('false');
    await click('Cloud AI',routes); await click('Allow Cloud AI');
    expect(button('Cloud AI',routes).getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    await click('Cloud AI',host.querySelector('.workspace-actions')!);
    expect(button('Local AI',routes).getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('turns the top switch on through consent without selecting Cloud chat or calling AI', async () => {
    await openWorkspace(); await click('Cloud AI', host.querySelector('.workspace-actions')!);
    await click('Allow Cloud AI');
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    expect(button('Local AI', host.querySelector('.chat-routes')!).getAttribute('aria-pressed')).toBe('true');
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('keeps cloud requests unavailable offline while Local AI remains selectable', async () => {
    await openWorkspace();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await act(async () => window.dispatchEvent(new Event('offline')));
    const routes = host.querySelector('.chat-routes')!;
    expect(button('Cloud AI',routes).disabled).toBe(true); expect(button('Local AI',routes).disabled).toBe(false);
    expect(button('Open level 2').disabled).toBe(true);
    await click('Cloud AI', host.querySelector('.workspace-actions')!);
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
    expect(mocks.ai).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('notes math keyboard', () => {
  it('toggles without changing notes and inserts a real symbol at the cursor', async () => {
    await openWorkspace();
    const original = stored().exercises[0].notes;
    expect(button('Show math keyboard').getAttribute('aria-expanded')).toBe('false');
    await click('Show math keyboard');
    expect(button('Hide math keyboard').getAttribute('aria-expanded')).toBe('true');
    expect(stored().exercises[0].notes).toBe(original);
    const input = host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!;
    input.setSelectionRange(0,0);
    await click('∫',host.querySelector('.notes-math-keys')!);
    expect(input.value).toBe('∫'+original);
    await click('Hide math keyboard'); await click('Save exercise');
    expect(stored().exercises[0].notes).toBe('∫'+original);
  });
  it('also supports the saved-page notes without rewriting the problem', async () => {
    await library(); await click('Open exercise');
    const statement=stored().exercises[0].statement;
    await click('Show math keyboard');
    const input=host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!;
    input.setSelectionRange(input.value.length,input.value.length);
    await click('x²',host.querySelector('.notes-math-keys')!); await click('Save notes');
    expect(stored().exercises[0].notes).toBe('Original notes²');
    expect(stored().exercises[0].statement).toBe(statement);
  });
});
