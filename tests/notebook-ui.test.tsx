// @vitest-environment happy-dom
import { act, forwardRef, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotebookRequest } from '../src/ai';
import type { Answer, Notebook } from '../src/notebook';

const mocks = vi.hoisted(() => ({ values: new Map<string, unknown>(),signedIn:true, ai: vi.fn(), diagram:vi.fn(), drawingExport:vi.fn(), imageCloud: vi.fn(), imageLocal: vi.fn(), readAttachment: vi.fn(), write: vi.fn(), pdf: vi.fn(), pdfPreview: vi.fn(), prepareImage: vi.fn(), readImage: vi.fn(), insert: vi.fn() }));
vi.mock('idb-keyval', () => ({ get: vi.fn(async (key: string) => structuredClone(mocks.values.get(key))), del: async (key: string) => { mocks.values.delete(key); }, set: async (key: string, value: unknown) => { mocks.write(key, value); mocks.values.set(key, structuredClone(value)); } }));
vi.mock('../src/notebook', async () => ({ ...(await vi.importActual<typeof import('../src/notebook')>('../src/notebook')), readAttachment: mocks.readAttachment }));
vi.mock('../src/firebase', () => ({ getFirebaseApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({ app: { options: { projectId: 'test' } } }),
  onAuthStateChanged: (_: unknown, callback: (value: unknown) => void) => { callback(mocks.signedIn?{ uid: 'alice', email: 'alice@example.test' }:null); return () => {}; },
  createUserWithEmailAndPassword: vi.fn(), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn()
}));
vi.mock('../src/ai', () => ({
  notebookAI: mocks.ai,
  generateProofDiagram:mocks.diagram,
  recognizeImageWithCloud: mocks.imageCloud,
  friendlyError: (error: Error) => error.message,
  recommendsCloudForProblem: (statement: string) => /\bprove\b/i.test(statement)
}));
vi.mock('../src/drawing-export',()=>({exportDrawing:mocks.drawingExport}));
vi.mock('../src/image-import',async original=>({...await original<typeof import('../src/image-import')>(),prepareProblemImage:mocks.prepareImage,readProblemImage:mocks.readImage}));
vi.mock('../src/pdf', () => ({ extractPdfQuestions: mocks.pdf, renderPdfPagePreview: mocks.pdfPreview }));
vi.mock('../src/pdf-ocr', () => ({ recognizeImageLocally: mocks.imageLocal }));
vi.mock('../src/components/PdfFormulaCropper', () => ({
  PdfFormulaCropper: ({ onInsert, onCloudRead, cloudOnly }: { onInsert?: (latex: string) => void; onCloudRead?: (image: string) => Promise<void>; cloudOnly?: boolean }) =>
    <>{!cloudOnly&&<button type="button" onClick={() => onInsert?.(String.raw`\frac{x^2}{2}`)}>Mock recognize formula</button>}<button type="button" onClick={() => void onCloudRead?.('data:image/png;base64,AA==')}>Mock read whole PDF page</button></>
}));
// MathLive caret/layout is tested manually in Chrome; these tests exercise page state and persistence.
vi.mock('../src/components/MathInput', () => ({ MathInput: forwardRef(function Field(props: { value: string; onChange?: (value: string) => void; readOnly?: boolean; disabled?: boolean; label?: string }, ref) {
  useImperativeHandle(ref, () => ({ focus() {}, replace(latex:string) {props.onChange?.(latex);}, insert(latex:string) {mocks.insert(latex);props.onChange?.(props.value+latex);} }));
  return <textarea aria-label={props.label ?? 'Problem statement'} readOnly={props.readOnly} disabled={props.disabled} value={props.value} onChange={event => props.onChange?.(event.target.value)}/>;
}) }));
import App from '../src/App';
import {geometryExamples} from '../src/geometry';
import {exampleProofScene} from '../src/geometry-proof-examples';
import {workspaceDraftKey} from '../src/workspace-draft';
import { emptyNotebook, newExercise, notebookKey } from '../src/notebook';

let root: Root; let host: HTMLDivElement;
const storageKey = notebookKey('test', 'alice');
function stored() { return mocks.values.get(storageKey)! as Notebook; }
function button(text: string, scope: ParentNode = host): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(value => value.textContent?.trim().startsWith(text));
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
async function click(text: string, scope?: ParentNode) { await act(async () => { button(text, scope).click(); }); }
async function type(selector: string, value: string, scope:ParentNode=host) {
  await act(async () => {
    const input = scope.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function chooseOption(label:string,text:string){
  await act(async()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
  const option=[...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option=>option.textContent?.startsWith(text))!;
  await act(async()=>option.click());
}
async function uploadPdf(questions:{page:number;text:string}[]){
  mocks.pdf.mockResolvedValue(questions);const file=new File(['pdf'],'worksheet.pdf',{type:'application/pdf'});
  const upload=host.querySelector<HTMLInputElement>('[aria-label="Choose a PDF"]')!;Object.defineProperty(upload,'files',{configurable:true,value:[file]});
  await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})));
  return file;
}
async function library() { await click('Exercise library'); await click('▱'); }
async function openWorkspace() { await library(); await click('Open exercise'); await click('Open in workspace'); }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  localStorage.removeItem('mathfolio-appearance-v1');
  mocks.signedIn=true;
  mocks.diagram.mockReset().mockImplementation(async(statement:string)=>({statement,scene:exampleProofScene(geometryExamples[0].statement)!,source:'local_construction',showAuxiliary:false}));
  mocks.ai.mockReset(); mocks.imageCloud.mockReset(); mocks.imageLocal.mockReset(); mocks.readAttachment.mockReset(); mocks.insert.mockReset(); mocks.write.mockReset(); mocks.pdf.mockReset(); mocks.pdfPreview.mockReset(); mocks.values.clear();
  mocks.prepareImage.mockReset().mockResolvedValue({ data: 'data:image/jpeg;base64,AA==', name: 'problem.jpg' });
  mocks.readImage.mockReset();mocks.drawingExport.mockReset().mockResolvedValue('data:image/png;base64,AA==');
  mocks.pdfPreview.mockResolvedValue('data:image/png;base64,AA==');
  mocks.imageCloud.mockResolvedValue(String.raw`Cloud transcription: \(x^2 + \sqrt{2}\)`);
  mocks.imageLocal.mockResolvedValue('Local transcription: x squared plus root two');
  mocks.readAttachment.mockImplementation(async (file: File, kind: 'problem' | 'solution') => ({ id: 'uploaded-image', name: file.name, data: 'data:image/png;base64,SGVsbG8=', kind }));
  const first = { ...newExercise(), id: 'first', updatedAt:'2001-01-01T12:00:00Z', title: 'Quadratic page', statement: 'x^2+2x=0', confirmed: true, notes: 'Original notes', knowledge: { text: 'Original essentials', source: 'local_reference' }, hints: [{ text: 'Original hint', source: 'on_device' }], messages: [{ role: 'user' as const, text: 'Original question' }], attachments: [{ id: 'image', name: 'solution.png', data: 'data:image/png;base64,AA==', kind: 'solution' as const }] };
  mocks.values.set(storageKey, { ...emptyNotebook(), exercises: [first, { ...newExercise(), id: 'second', updatedAt:'2000-01-01T12:00:00Z', title: 'Second page', statement: 'x=1', confirmed: true }] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<App/>); });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('workspace menus and login backdrop',()=>{
  it('dismisses temporary tools outside while preserving typed notes and the chosen appearance',async()=>{
    await type('[aria-label="Notes"]','Keep my draft');const study=host.querySelector<HTMLDetailsElement>('.study-options')!,appearance=host.querySelector<HTMLDetailsElement>('.appearance-disclosure')!;
    await act(async()=>study.querySelector<HTMLElement>('summary')!.click());expect(study.open).toBe(true);
    const summary=appearance.querySelector<HTMLElement>('summary')!;await act(async()=>{summary.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));summary.click();});expect(study.open).toBe(false);expect(appearance.open).toBe(true);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Theme"]')!.click());await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option=>option.textContent?.startsWith('Dark'))!.click());
    expect(appearance.open).toBe(true);expect(document.documentElement.dataset.theme).toBe('dark');
    await act(async()=>host.querySelector<HTMLElement>('.notes')!.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})));expect(appearance.open).toBe(false);expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('Keep my draft');
  });
  it('keeps the four main actions in their own group with content tools separate',()=>{
    const actions=host.querySelector('[aria-label="Exercise actions"]')!;
    expect(actions.contains(button('＋ New exercise'))).toBe(true);expect(actions.contains(button('Focus mode'))).toBe(true);expect(actions.contains(button('Save exercise'))).toBe(true);expect(actions.querySelector('[role="switch"]')).not.toBeNull();
    expect(actions.querySelector('.study-options')).toBeNull();expect(host.querySelector('.workspace-tools .study-options')).not.toBeNull();
  });
  it('shows decorative mathematics only on the signed-out page without changing login input',async()=>{
    mocks.signedIn=false;await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));
    const backdrop=document.querySelector('.login-math-backdrop')!;expect(backdrop.parentElement).toBe(document.body);expect(backdrop.getAttribute('aria-hidden')).toBe('true');expect(backdrop.querySelectorAll('span')).toHaveLength(20);expect(backdrop.querySelector('button,input,a')).toBeNull();
    await type('input[type="email"]','learner@example.test');await type('input[type="password"]','sample-password');await act(async()=>host.querySelector<HTMLElement>('.appearance-disclosure summary')!.click());await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Theme"]')!.click());
    await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option=>option.textContent?.startsWith('Dark'))!.click());
    expect(host.querySelector<HTMLInputElement>('input[type="email"]')!.value).toBe('learner@example.test');expect(host.querySelector<HTMLInputElement>('input[type="password"]')!.value).toBe('sample-password');expect(mocks.ai).not.toHaveBeenCalled();
  });
});

describe('pastel folder colors',()=>{
  async function reload(){await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));}
  async function choose(name:string,scope:ParentNode){await act(async()=>scope.querySelector<HTMLButtonElement>(`[aria-label="${name} pastel"]`)!.click());}
  it('creates a colored folder and restores its color on reload',async()=>{
    await click('Exercise library');await click('＋ New folder');
    await type('[aria-labelledby="folder-title"] input','Geometry');const dialog=host.querySelector('[aria-labelledby="folder-title"]')!;
    await choose('Lavender',dialog);await click('Create folder');
    expect(stored().folders.find(folder=>folder.name==='Geometry')!.color).toBe('lavender');
    await reload();await click('Exercise library');const card=[...host.querySelectorAll('.folder-card')].find(card=>card.textContent?.includes('Geometry'))!;
    expect(card.getAttribute('data-folder-color')).toBe('lavender');expect(card.querySelector('[aria-label="Lavender pastel"]')!.getAttribute('aria-pressed')).toBe('true');
  });
  it('does not apply a failed color save, allows retry, and leaves exercises untouched',async()=>{
    const before=structuredClone(stored().exercises);await click('Exercise library');const card=host.querySelector('.folder-card')!;
    await act(async()=>card.querySelector<HTMLElement>('summary')!.click());mocks.write.mockImplementationOnce(()=>{throw new Error('Storage is full');});await choose('Rose',card);
    expect(stored().folders[0].color).toBeUndefined();expect(card.getAttribute('data-folder-color')).toBe('sage');expect(host.textContent).toContain('Storage is full');
    await choose('Sky',card);expect(card.getAttribute('data-folder-color')).toBe('sky');expect(stored().folders[0].color).toBe('sky');expect(stored().exercises).toEqual(before);expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('can choose the new folder color while saving an exercise',async()=>{
    await type('[aria-label="Problem statement"]','x=7');await click('Save exercise');await type('[aria-labelledby="save-title"] label input','Colored page');
    await type('[aria-label="New folder name"]','Revision');await choose('Butter',host.querySelector('[aria-labelledby="save-title"]')!);await click('Save on this device');
    const folder=stored().folders.find(folder=>folder.name==='Revision')!;expect(folder.color).toBe('butter');expect(stored().exercises[0].folderIds).toContain(folder.id);
  });
});

describe('library image edits and shared folders',()=>{
  async function reload(){await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));}
  function folders(){stored().folders.push({id:'a',name:'Algebra'},{id:'b',name:'Revision'});}
  async function selectFolder(name:string,scope:ParentNode=host){const label=[...scope.querySelectorAll('label')].find(item=>item.textContent?.trim()===name)!;await act(async()=>label.querySelector<HTMLInputElement>('input')!.click());}
  it('shows illustrations with the problem, solution images with notes, and saves renamed/added/removed images in place',async()=>{
    stored().exercises[0].attachments.push({id:'diagram',kind:'problem',name:'diagram.png',data:'data:image/png;base64,AQ=='});
    const original=structuredClone(stored().exercises[0]);await reload();await library();await click('Open exercise');
    const problem=host.querySelector('.preview-columns .preview-section')!,notes=host.querySelector('.preview-notes')!;
    expect(problem.textContent).toContain('diagram.png');expect(problem.textContent).not.toContain('solution.png');expect(notes.textContent).toContain('solution.png');
    await click('Rename',problem);await type('[aria-label="Image name"]','Given diagram');await click('Apply name',problem);
    await click('Remove',notes);expect(stored().exercises[0].attachments).toEqual(original.attachments);
    const upload=host.querySelector<HTMLInputElement>('[aria-label="Attach a solution in preview"]')!;
    Object.defineProperty(upload,'files',{configurable:true,value:[new File(['solution'],'new-work.png',{type:'image/png'})]});
    await act(async()=>{upload.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,20));});
    expect(notes.textContent).toContain('new-work.png');await click('Save changes');
    const saved=stored().exercises[0];expect(saved.attachments.map(image=>image.name)).toEqual(['Given diagram','new-work.png']);
    expect(saved.statement).toBe(original.statement);expect(saved.hints).toEqual(original.hints);expect(saved.knowledge).toEqual(original.knowledge);expect(mocks.ai).not.toHaveBeenCalled();
    await click('Close',host.querySelector('.exercise-preview')!);await click('Open exercise');expect(host.querySelector('.preview-notes')!.textContent).toContain('new-work.png');
  });
  it('protects unsaved image edits on close and never turns rename Escape into closing the preview',async()=>{
    await library();await click('Open exercise');await click('Rename',host.querySelector('.preview-notes')!);
    const input=host.querySelector<HTMLInputElement>('[aria-label="Image name"]')!;await act(async()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(host.querySelector('.exercise-preview')).not.toBeNull();expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    await click('Remove',host.querySelector('.preview-notes')!);await click('Close',host.querySelector('.exercise-preview')!);expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    await click('Discard changes & continue');expect(stored().exercises[0].attachments).toHaveLength(1);
  });
  it('can add a saved page to multiple folders from preview without copying it',async()=>{
    folders();await reload();await library();await click('Open exercise');await selectFolder('Algebra');await selectFolder('Revision');
    expect(stored().exercises[0].folderIds).toBeUndefined();await click('Save changes');expect(stored().exercises).toHaveLength(2);expect(stored().exercises[0].folderIds).toEqual(['a','b']);
    await click('Close',host.querySelector('.exercise-preview')!);await click('← All folders');
    const cards=[...host.querySelectorAll('.folder-card')];expect(cards.find(card=>card.textContent?.includes('My exercises'))!.textContent).toContain('2 exercises');
    for(const name of ['Algebra','Revision'])expect(cards.find(card=>card.textContent?.includes(name))!.textContent).toContain('1 exercises');
  });
  it('saves a new page in multiple folders while always including it in history',async()=>{
    folders();await reload();await type('[aria-label="Problem statement"]','x=7');await click('Save exercise');await type('[aria-labelledby="save-title"] label input','New shared exercise');
    await selectFolder('Algebra',host.querySelector('[aria-labelledby="save-title"]')!);await selectFolder('Revision',host.querySelector('[aria-labelledby="save-title"]')!);await click('Save on this device');
    expect(stored().exercises).toHaveLength(3);expect(stored().exercises[0].folderIds).toEqual(['a','b']);
    await library();expect(host.querySelectorAll('.exercise-card')).toHaveLength(3);
  });
  it('deletes a shared history page everywhere after explicit confirmation',async()=>{
    folders();stored().exercises[0].folderIds=['a','b'];stored().exercises[0].folderId='a';await reload();await library();
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(2);await click('Delete',host.querySelector('.exercise-card')!);
    expect(host.querySelector('[role="alertdialog"]')!.textContent).toContain('every other folder');await click('Delete exercise');
    expect(stored().exercises.map(page=>page.id)).toEqual(['second']);await click('← All folders');
    for(const card of [...host.querySelectorAll('.folder-card')].filter(card=>/Algebra|Revision/.test(card.textContent??'')))expect(card.textContent).toContain('0 exercises');
  });
  it('keeps staged image and folder edits after a failed save and allows retry',async()=>{
    folders();await reload();await library();await click('Open exercise');await selectFolder('Algebra');await click('Remove',host.querySelector('.preview-notes')!);
    mocks.write.mockImplementationOnce(()=>{throw new Error('Storage is full');});await click('Save changes');
    expect(stored().exercises[0].attachments).toHaveLength(1);expect(stored().exercises[0].folderIds).toBeUndefined();expect(host.querySelector('.exercise-preview')!.textContent).toContain('Storage is full');
    expect(host.querySelector('.preview-notes')!.textContent).not.toContain('solution.png');await click('Save changes');expect(stored().exercises[0].attachments).toEqual([]);expect(stored().exercises[0].folderIds).toEqual(['a']);
  });
  it('preserves independent workspace notes while following library image and folder edits',async()=>{
    folders();await reload();await openWorkspace();await type('[aria-label="Notes"]','Workspace-only notes');await click('Exercise library');await click('Open exercise');
    await click('Rename',host.querySelector('.preview-notes')!);await type('[aria-label="Image name"]','Proof photo');await click('Apply name');await selectFolder('Revision');await click('Save changes');
    expect(stored().exercises[0].notes).toBe('Original notes');await click('Close',host.querySelector('.exercise-preview')!);await click('Workspace');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('Workspace-only notes');await click('Save exercise');
    expect(stored().exercises[0].attachments[0].name).toBe('Proof photo');expect(stored().exercises[0].folderIds).toEqual(['b']);expect(stored().exercises[0].notes).toBe('Workspace-only notes');expect(stored().exercises).toHaveLength(2);
  });
});

describe('explicit knowledge and first-hint routing',()=>{
  it('chooses cloud independently for knowledge without generating until Analyze is pressed',async()=>{
    await type('[aria-label="Problem statement"]','Prove a theorem');
    await chooseOption('Knowledge AI','Cloud AI');expect(mocks.ai).not.toHaveBeenCalled();await click('Not now');
    expect(host.querySelector('[aria-label="Knowledge AI"]')!.textContent).toContain('Local AI');
    await chooseOption('Knowledge AI','Cloud AI');await click('Allow Cloud AI');expect(mocks.ai).not.toHaveBeenCalled();
    mocks.ai.mockResolvedValue({text:'A relevant theorem.',source:'IN_CLOUD'});await click('Confirm & analyze');
    expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'knowledge',route:'cloud',cloudAllowed:true});
    expect(host.querySelector('[aria-label="Hint 1 AI"]')!.textContent).toContain('Local AI');
    await chooseOption('Knowledge AI','Local AI');await click('Refresh knowledge');expect(mocks.ai.mock.calls[1][0].route).toBe('local');
  });
  it('runs hint 1 in cloud only when chosen, and resets choices when Cloud AI is switched off',async()=>{
    const book=stored();book.exercises[0].hints=[];await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));await openWorkspace();
    await chooseOption('Hint 1 AI','Cloud AI');expect(mocks.ai).not.toHaveBeenCalled();await click('Allow Cloud AI');
    mocks.ai.mockResolvedValue({text:'Use the decisive first step.',source:'IN_CLOUD'});await click('Open level 1');
    expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint1',route:'cloud',cloudAllowed:true});
    await click('Cloud AI',host.querySelector('.workspace-actions')!);
    expect(host.querySelector('[aria-label="Knowledge AI"]')!.textContent).toContain('Local AI');expect(host.querySelector('[aria-label="Hint 1 AI"]')!.textContent).toContain('Local AI');
  });
});

describe('multi-question PDF review',()=>{
  it('preserves edits and selections across pages and imports selected questions in document order',async()=>{
    await type('[aria-label="Notes"]','Keep my notes');
    await uploadPdf([{page:1,text:'1. Solve x^2=4'},{page:2,text:'2. Find y+1=3'},{page:2,text:'3. Find z=8'}]);
    await type('[aria-label="Extracted question 1"]',String.raw`\text{1. Solve }x^2=9`);
    await click('Next page');await click('Select all shown');
    expect(host.querySelectorAll('.pdf-review-question')).toHaveLength(3);
    await type('[aria-label="Extracted question 2"]',String.raw`\text{2. Find }y+1=5`);
    await click('Previous page');expect(host.querySelector<HTMLInputElement>('[aria-label="Select question 1"]')!.checked).toBe(true);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toContain('x^2=9');
    await click('Use 3 questions');
    const statement=host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value;
    expect(statement.indexOf('x^2=9')).toBeLessThan(statement.indexOf('y+1=5'));expect(statement.indexOf('y+1=5')).toBeLessThan(statement.indexOf('z=8'));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('Keep my notes');expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('keeps the 6,000-character combined limit without truncating any selected question',async()=>{
    await uploadPdf([{page:1,text:'1. First'},{page:1,text:'2. Second'}]);
    await click('Select all shown');await type('[aria-label="Extracted question 1"]','a'.repeat(3100));await type('[aria-label="Extracted question 2"]','b'.repeat(3100));
    expect(button('Use 2 questions').disabled).toBe(true);expect(host.textContent).toContain('select fewer');
    await click('Deselect',host.querySelector('[aria-label="Review question 2"]')!);expect(button('Use this question').disabled).toBe(false);await click('Use this question');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('a'.repeat(3100));
  });
  it('opens the source in the image viewer and closes only that viewer on Escape',async()=>{
    await uploadPdf([{page:1,text:'1. Find x'}]);await type('[aria-label="Extracted question 1"]',String.raw`\text{Keep my edit}`);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Enlarge PDF page 1"]')!.click());
    expect(host.querySelector('.image-viewer')).not.toBeNull();expect(host.querySelector('.pdf-backdrop')!.hasAttribute('inert')).toBe(true);
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(host.querySelector('.image-viewer')).toBeNull();expect(host.querySelector('.pdf-dialog')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toContain('Keep my edit');
  });
  it('stops page reading and rejects late text while preserving the extracted questions',async()=>{
    await uploadPdf([{page:1,text:'1. Original question'}]);let finish!:(text:string)=>void;
    mocks.imageCloud.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    await click('Read this page with Cloud AI');await click('Allow Cloud AI and read page');
    const signal=mocks.imageCloud.mock.calls[0][1] as AbortSignal;await click('Stop page reading');expect(signal.aborted).toBe(true);
    await act(async()=>finish('1. LATE RESULT'));expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toContain('Original question');
    expect(host.textContent).not.toContain('LATE RESULT');expect(button('Read this page with Cloud AI').disabled).toBe(false);
  });
  it('replaces only the page explicitly sent to cloud, retaining other page edits and selection',async()=>{
    await uploadPdf([{page:1,text:'1. Keep this question'},{page:2,text:'2. Old OCR'}]);
    await type('[aria-label="Extracted question 1"]',String.raw`\text{Keep page one edit}`);await click('Next page');
    mocks.imageCloud.mockResolvedValue(String.raw`2. Solve \(\frac{1}{2}+x=3\)
3. Find \(a_n=n^2\)`);
    await click('Read this page with Cloud AI');await click('Allow Cloud AI and read page');
    expect(host.querySelectorAll('.pdf-review-question')).toHaveLength(3);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toContain('Keep page one edit');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 2"]')!.value).toContain(String.raw`\frac{1}{2}`);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 3"]')!.value).toContain('a_n=n^2');
  });
});

describe('independent hint levels', () => {
  it('opens the full solution first, saves its level and keeps it out of earlier hints', async () => {
    await type('[aria-label="Problem statement"]', 'Solve 3x = 12');
    mocks.ai.mockResolvedValueOnce({text:'Linear equations', source:'on_device'});
    await click('Confirm & analyze');
    for (const level of [1, 2, 3]) expect(button(`Open level ${level}`).disabled).toBe(false);

    mocks.ai.mockResolvedValueOnce({text:'The answer is four.', source:'on_device'});
    await click('Open level 3');
    const tiers = host.querySelectorAll('.hint-tier');
    expect(tiers[2].textContent).toContain('The answer is four.');
    expect(button('Open level 1').disabled).toBe(false);
    expect(button('Open level 2').disabled).toBe(false);
    expect(mocks.ai.mock.calls.map(([request]) => request.purpose)).toEqual(['knowledge', 'hint3']);

    await click('Save exercise');
    await type('.save-dialog label input', 'Independent hints');
    await click('Save on this device');
    await click('Exercise library');
    await click('All exercises');
    const card = [...host.querySelectorAll('.exercise-card')].find(el => el.textContent?.includes('Independent hints'))!;
    expect(card.textContent).toContain('1/3 hints opened');
    await click('Open exercise', card);
    const previewHints = host.querySelectorAll('.exercise-preview .preview-section details summary');
    expect([...previewHints].map(el => el.textContent)).toEqual(['Level 3 · Full solution']);
    await click('Open in workspace');

    mocks.ai.mockResolvedValueOnce({text:'Look at the coefficient.', source:'on_device'});
    await click('Open level 1');
    expect(mocks.ai.mock.calls.at(-1)![0]).toMatchObject({purpose:'hint1', hints:[]});
    mocks.ai.mockResolvedValueOnce({text:'Divide both sides.', source:'on_device'});
    await click('Open level 2');
    expect(mocks.ai.mock.calls.at(-1)![0]).toMatchObject({purpose:'hint2', hints:['Look at the coefficient.']});
    expect(host.querySelectorAll('.hint-toggle')).toHaveLength(3);
  });
});

describe('online suggestions for later hint levels',()=>{
  it('offers cloud on levels 2 and 3 and generates only after permission with the correct route',async()=>{
    await openWorkspace();const tiers=host.querySelectorAll('.hint-tier');
    expect(tiers[0].querySelector('.hint-cloud-suggestion')).toBeNull();expect(tiers[1].textContent).toContain('Cloud AI is available');expect(tiers[2].textContent).toContain('Cloud AI is available');
    await click('Use Cloud AI',tiers[1]);expect(mocks.ai).not.toHaveBeenCalled();await click('Not now',host.querySelector('[role="alertdialog"]')!);expect(mocks.ai).not.toHaveBeenCalled();
    mocks.ai.mockResolvedValue({text:'Cloud method',source:'IN_CLOUD'});await click('Use Cloud AI',tiers[1]);await click('Allow Cloud AI',host.querySelector('[role="alertdialog"]')!);
    expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint2',route:'cloud',cloudAllowed:true});expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    await click('Cloud AI',host.querySelector('.workspace-actions')!);await click('Use Cloud AI',host.querySelectorAll('.hint-tier')[2]);await click('Allow Cloud AI',host.querySelector('[role="alertdialog"]')!);
    expect(mocks.ai.mock.calls[1][0]).toMatchObject({purpose:'hint3',route:'cloud',cloudAllowed:true});
  });
  it('hides the cloud suggestion offline while keeping the local level available',async()=>{
    await openWorkspace();vi.stubGlobal('navigator',{onLine:false});await act(async()=>window.dispatchEvent(new Event('offline')));
    expect(host.querySelector('.hint-cloud-suggestion')).toBeNull();expect(button('Open level 2').disabled).toBe(false);
    mocks.ai.mockResolvedValue({text:'Local method',source:'ON_DEVICE'});await click('Open level 2');expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint2',route:'local'});
  });
});

describe('saved page previews and workspace copies', () => {
  it('formats recognized PDF notation directly in the editable question and restores the extraction',async()=>{
    const raw='Bài 2.1. Những khẳng định\nnào sau đây là đúng?\na)0 ∈ ∅ b)∅ ⊆ {0}';
    await uploadPdf([{page:1,text:raw}]);
    const initial=host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value;
    expect(initial).toContain('Những khẳng định nào sau đây là đúng?');expect(initial).toContain(String.raw`\subseteq`);
    await type('[aria-label="Extracted question 1"]',String.raw`\frac{1}{2}`);await click('Restore extracted text');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toBe(initial);
    await click('Use this question');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe(initial);expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('suggests Cloud AI for a complex problem without enabling it or sending data', async () => {
    await type('[aria-label="Problem statement"]', 'Prove that the sequence converges and justify each step.');
    expect(host.querySelector('.cloud-recommendation')?.textContent).toContain('Cloud AI can provide deeper analysis');
    await click('Consider Cloud AI');
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('Cloud AI may provide deeper reasoning');
    expect(host.querySelector('.cloud-recommendation')).not.toBeNull();
    expect(mocks.ai).not.toHaveBeenCalled();
    await click('Allow Cloud AI');
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Cloud AI"]')?.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('.cloud-recommendation')).toBeNull();
    expect(mocks.ai).not.toHaveBeenCalled();
  });

  it('lets the learner change pages, select a question and edit its math before inserting it',async()=>{
    const file=await uploadPdf([{page:1,text:'1. Solve x^2=4'},{page:2,text:'2. Find y when y+1=3'}]);
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('Choose questions from your PDF');
    await chooseOption('PDF page','Page 2');await click('Clear selection');
    await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Select question 2"]')!.click());
    await type('[aria-label="Extracted question 2"]',String.raw`\text{2. Find y when }y+1=5`);
    await click('Use this question');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toContain('y+1=5');expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.pdfPreview).toHaveBeenCalledWith(file,1);expect(mocks.pdfPreview).toHaveBeenCalledWith(file,2);expect(mocks.ai).not.toHaveBeenCalled();
  });

  it('imports geometry from PDF without generating a diagram',async()=>{
    await uploadPdf([{page:1,text:geometryExamples[0].statement}]);await click('Use this question');
    expect(host.querySelector('.proof-board')).toBeNull();expect(host.textContent).not.toContain('Create diagram');
    expect(button('Draw illustration').disabled).toBe(false);expect(mocks.diagram).not.toHaveBeenCalled();
  });

  it('filters only the active page without losing questions selected on another page',async()=>{
    await uploadPdf([{page:1,text:'1. Solve x^2=4'},{page:2,text:'2. Find y when y+1=3'}]);
    await click('Next page');await type('[aria-label="Search PDF questions"]','Find');
    expect(host.querySelectorAll('[role="listitem"]')).toHaveLength(1);expect(host.querySelector('[role="listitem"]')!.textContent).toContain('Page 2');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toContain('Solve');
    await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Select question 2"]')!.click());
    await click('Previous page');expect(host.querySelector<HTMLInputElement>('[aria-label="Select question 1"]')!.checked).toBe(true);
    expect(host.querySelectorAll('.pdf-review-question')).toHaveLength(2);
  });

  it('keeps illustrations for viewing and AI context without per-image reading actions',async()=>{
    await type('[aria-label="Problem statement"]','Keep this problem');
    const upload=host.querySelector<HTMLInputElement>('[aria-label="Attach a problem illustration"]')!;
    Object.defineProperty(upload,'files',{configurable:true,value:[new File(['image'],'diagram.png',{type:'image/png'})]});
    await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})));
    const panel=host.querySelector('[aria-label="Problem illustrations"]')!;
    expect(panel.textContent).toContain('diagram.png');expect(panel.querySelector('img')).not.toBeNull();
    expect([...panel.querySelectorAll('button')].some(button=>/Read locally|Read with Cloud AI/.test(button.textContent??''))).toBe(false);
    expect(panel.querySelector<HTMLInputElement>('.image-ai-choice input')!.checked).toBe(true);
    await click('Cloud AI',host.querySelector('.workspace-actions')!);await click('Allow Cloud AI');
    expect(panel.textContent).not.toMatch(/Read locally|Read with Cloud AI/);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('Keep this problem');
    expect(mocks.ai).not.toHaveBeenCalled();expect(mocks.imageCloud).not.toHaveBeenCalled();expect(mocks.imageLocal).not.toHaveBeenCalled();
  });

  it('asks visible consent and enables Cloud AI when reading a PDF page from an off session',async()=>{
    await uploadPdf([{page:1,text:'1. Original question'}]);
    await click('Read this page with Cloud AI');
    expect(host.querySelector('[role="alertdialog"]')!.textContent).toContain('Allow Cloud AI and read this page?');
    expect(host.querySelector('.pdf-backdrop')!.hasAttribute('inert')).toBe(true);expect(mocks.imageCloud).not.toHaveBeenCalled();
    await click('Not now');expect(mocks.imageCloud).not.toHaveBeenCalled();
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
    mocks.imageCloud.mockResolvedValue(String.raw`1. Solve \(\frac{x}{2}=3\)`);
    await click('Read this page with Cloud AI');await click('Allow Cloud AI and read page');
    expect(mocks.imageCloud).toHaveBeenCalledWith('data:image/png;base64,AA==',expect.any(AbortSignal));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Extracted question 1"]')!.value).toContain(String.raw`\frac{x}{2}=3`);
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
  });

  it('keeps PDF upload available and confirms replacement of an analyzed problem', async () => {
    await openWorkspace();
    mocks.pdf.mockResolvedValue([{ page: 1, text: '1. Integrate x dx' }]);
    const upload = host.querySelector<HTMLInputElement>('[aria-label="Choose a PDF"]')!;
    const file = new File(['mock pdf'], 'replacement.pdf', { type: 'application/pdf' });
    Object.defineProperty(upload, 'files', { configurable: true, value: [file] });
    await act(async () => { upload.dispatchEvent(new Event('change', { bubbles: true })); });
    await click('Use this question');

    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('clears its knowledge, hints, and chat');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('x^2+2x=0');
    await click('Replace with PDF text');

    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toContain('Integrate');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toContain(String.raw`x\differentialD x`);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.readOnly).toBe(false);
    expect(host.textContent).not.toContain('Original essentials');
    expect(host.textContent).not.toContain('Original hint');
    expect(host.textContent).toContain('your notes and attachments were kept');
  });

  it('reports PDF extraction errors without opening an empty question picker', async () => {
    mocks.pdf.mockRejectedValue(new Error('Could not recognize text in this PDF.'));
    const upload = host.querySelector<HTMLInputElement>('[aria-label="Choose a PDF"]')!;
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['mock'], 'scan.pdf', { type: 'application/pdf' })] });
    await act(async () => { upload.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not recognize text');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

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

  it('opens all saved content in a dismissible preview; problem and AI content stay read-only', async () => {
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
    expect(button('Save changes').disabled).toBe(false);
    await click('Save changes');
    const { notes, notesFormat, updatedAt, ...other } = stored().exercises[0];expect(notesFormat).toBe('latex');
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
    await click('Close', host.querySelector('[role="dialog"]')!); await click('Discard changes & continue');
    expect(stored().exercises[0].notes).toBe('Original notes');
  });
  it('keeps the edited notes and original saved page when storage fails, then allows retry', async () => {
    await library(); await click('Open exercise');
    await type('[aria-label="Saved exercise notes"]', 'Notes to retry');
    mocks.write.mockImplementationOnce(() => { throw new Error('Storage is full'); });
    await click('Save changes');
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('Storage is full');
    expect(stored().exercises[0].notes).toBe('Original notes');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe('Notes to retry');
    expect(button('Save changes').disabled).toBe(false);
    await click('Save changes'); expect(stored().exercises[0].notes).toBe('Notes to retry');
  });
  it('keeps workspace edits out of the saved page until Save overwrites the same exercise', async () => {
    await openWorkspace(); await type('[aria-label="Notes"]', 'Uncommitted workspace');
    await click('Exercise library'); await click('Open exercise');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe(String.raw`\text{Original notes}`);
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
    await click('Confirm & analyze'); await click('■ Stop AI');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
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
  it('resets old hint levels only after confirmation and preserves the saved original until Save',async()=>{
    await openWorkspace();await click('Reset hints',host.querySelector('.hints')!);
    await click('Keep working',host.querySelector('[role="alertdialog"]')!);expect(host.querySelector('.hints')!.textContent).toContain('Original hint');
    await click('Reset hints',host.querySelector('.hints')!);await click('Reset hints',host.querySelector('[role="alertdialog"]')!);
    expect(host.querySelector('.hints')!.textContent).not.toContain('Original hint');expect(button('Open level 1').disabled).toBe(false);
    expect(host.querySelector('.knowledge')!.textContent).toContain('Original essentials');expect(stored().exercises[0].hints[0].text).toBe('Original hint');expect(mocks.ai).not.toHaveBeenCalled();
    mocks.ai.mockResolvedValue({text:'Fresh complete hints',source:'ON_DEVICE'});await click('Open level 1');expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint1',route:'local'});
  });
});

describe('independent conversation and notes',()=>{
  it.each(['','An unconfirmed problem'])('allows chat with problem %j before knowledge or hints',async statement=>{
    if(statement)await type('[aria-label="Problem statement"]',statement);
    const notes=host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!;
    const chat=host.querySelector<HTMLTextAreaElement>('[aria-label="Discussion question"]')!;
    expect(notes.disabled).toBe(false);expect(chat.disabled).toBe(false);
    await type('[aria-label="Notes"]','My own approach');
    await type('[aria-label="Discussion question"]','What does a Cauchy sequence mean?');
    mocks.ai.mockResolvedValue({text:'Compare every pair of sufficiently late terms.',source:'on_device'});
    await click('Send');
    expect(mocks.ai).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({purpose:'chat',statement,knowledge:'',hints:[],route:'local',cloudAllowed:false}),expect.any(Function),expect.any(AbortSignal));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('My own approach');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Discussion question"]')!.value).toBe('');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.readOnly).toBe(false);
    expect(button('Open level 1').disabled).toBe(true);expect(host.querySelector('.messages')!.textContent).toContain('Compare every pair');
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it('keeps cloud consent and Stop behavior for an unanalyzed conversation',async()=>{
    await type('[aria-label="Discussion question"]','Explain limits');
    await click('Cloud AI',host.querySelector('.chat-routes')!);await click('Not now');
    expect(mocks.ai).not.toHaveBeenCalled();
    await click('Cloud AI',host.querySelector('.chat-routes')!);await click('Allow Cloud AI');
    let finish!:(answer:Answer)=>void;
    mocks.ai.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
    await click('Send');expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'chat',statement:'',route:'cloud',cloudAllowed:true});
    await click('■ Stop AI');await act(async()=>finish({text:'Late output',source:'in_cloud'}));
    expect(host.querySelector('.messages')!.textContent).not.toContain('Late output');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Discussion question"]')!.value).toBe('Explain limits');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.disabled).toBe(false);
  });
});

describe('completion directly in the library',()=>{
  it('toggles the shared saved record both ways and updates completion filters after reload',async()=>{
    await library();await click('Mark completed');
    expect(stored().exercises.find(exercise=>exercise.id==='first')!.completed).toBe(true);
    await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));
    await library();
    const filter=host.querySelector<HTMLSelectElement>('[aria-label="Exercise status"]')!;
    await act(async()=>{filter.value='completed';filter.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(1);expect(host.querySelector('.exercise-card')!.textContent).toContain('Quadratic page');
    await click('Mark in progress');
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(0);
    expect(stored().exercises.find(exercise=>exercise.id==='first')!.completed).toBe(false);expect(stored().exercises).toHaveLength(2);
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('leaves saved data and the displayed status intact on failure, then allows retry',async()=>{
    await library();const before=structuredClone(stored());
    mocks.write.mockImplementationOnce(()=>{throw new Error('Storage is full');});
    await click('Mark completed');
    expect(stored()).toEqual(before);expect(host.textContent).toContain('Storage is full');expect(button('Mark completed').disabled).toBe(false);
    expect(host.querySelector('.exercise-card .tag')!.textContent).toBe('In progress');
    await click('Mark completed');expect(stored().exercises.find(exercise=>exercise.id==='first')!.completed).toBe(true);
  });
  it('updates the active workspace status while preserving its unsaved work',async()=>{
    await openWorkspace();await type('[aria-label="Notes"]','Unsaved reasoning');
    await click('Exercise library');await click('Mark completed');
    expect(stored().exercises.find(exercise=>exercise.id==='first')!.notes).toBe('Original notes');
    await click('Workspace');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('Unsaved reasoning');
    expect(host.querySelector<HTMLInputElement>('.notes .check input')!.checked).toBe(true);
    await click('Save exercise');
    expect(stored().exercises.find(exercise=>exercise.id==='first')).toMatchObject({notes:'Unsaved reasoning',completed:true});expect(stored().exercises).toHaveLength(2);
  });
});

describe('Cloud AI permission and chat controls', () => {
  it('uses local hints by default and uses cloud hints only after explicit consent', async () => {
    await openWorkspace(); mocks.ai.mockResolvedValue({text:'Allowed cloud hint',source:'in_cloud'});
    expect(host.querySelector('.hints input[type="checkbox"]')).toBeNull();
    await click('Open level 2');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint2',cloudAllowed:false,route:'local'});
    expect(host.textContent).toContain('Allowed cloud hint');
    await click('Cloud AI', host.querySelector('.workspace-actions')!);
    await click('Allow Cloud AI');
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('true');
    await click('Open level 3');
    expect(mocks.ai.mock.calls[1][0]).toMatchObject({purpose:'hint3',cloudAllowed:true,route:'cloud'});
    expect(mocks.ai).toHaveBeenCalledTimes(2);
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
    expect(button('Open level 2').disabled).toBe(false);
    await click('Cloud AI', host.querySelector('.workspace-actions')!);
    expect(host.querySelector('[role="switch"]')!.getAttribute('aria-checked')).toBe('false');
    expect(mocks.ai).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('notes math keyboard', () => {
  it('keeps common symbols visible and expands categorized symbols without changing the draft', async () => {
    const keyboard=host.querySelector('.problem .math-keyboard')!;
    expect(keyboard.textContent).toContain('∅'); expect(keyboard.textContent).toContain('⊆');
    await click('More symbols',keyboard);
    expect(button('Math symbols',keyboard).getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.symbol-browser')).not.toBeNull();
    await click('Greek letters',document.querySelector('.symbol-browser')!);
    expect(document.querySelector('.symbol-category-content')!.getAttribute('aria-label')).toBe('Greek letters');
    expect(document.querySelector('.symbol-category-content')!.textContent).toContain('Ω');
    await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Close symbol keyboard"]')!.click());
    expect(document.querySelector('.symbol-browser')).toBeNull();
    expect(mocks.ai).not.toHaveBeenCalled(); expect(mocks.write).not.toHaveBeenCalled();
  });
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
    expect(mocks.insert).toHaveBeenCalledWith(String.raw`\int_{#?}^{#?}`);expect(input.value).toContain(String.raw`\int`);
    await click('Hide math keyboard'); await click('Save exercise');
    expect(stored().exercises[0].notes).toContain(String.raw`\int`);expect(stored().exercises[0].notesFormat).toBe('latex');
  });
  it('also supports the saved-page notes without rewriting the problem', async () => {
    await library(); await click('Open exercise');
    const statement=stored().exercises[0].statement;
    await click('Show math keyboard');
    const input=host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!;
    input.setSelectionRange(input.value.length,input.value.length);
    await click('x²',host.querySelector('.notes-math-keys')!); await click('Save changes');
    expect(mocks.insert).toHaveBeenCalledWith('^{2}');expect(stored().exercises[0].notes).toBe(String.raw`\text{Original notes}^{2}`);expect(stored().exercises[0].notesFormat).toBe('latex');
    expect(stored().exercises[0].statement).toBe(statement);
  });
});

describe('workspace recovery and library tools',()=>{
  it('autosaves a separate copy, recovers it after reload, and replaces the saved page only on Save',async()=>{
    await openWorkspace();await type('[aria-label="Notes"]','Recovered notes');
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,850));});
    expect(host.querySelector('.save-state')?.textContent).toContain('Draft saved');
    expect(stored().exercises[0].notes).toBe('Original notes');
    expect(mocks.values.has(workspaceDraftKey(storageKey))).toBe(true);
    await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));
    expect(host.querySelector('[aria-label="Recover workspace draft"]')).not.toBeNull();
    await click('Resume draft');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('Recovered notes');
    expect(stored().exercises[0].notes).toBe('Original notes');
    await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true})));
    expect(stored().exercises[0]).toMatchObject({id:'first',notes:'Recovered notes'});
    expect(stored().exercises).toHaveLength(2);
    expect(mocks.values.has(workspaceDraftKey(storageKey))).toBe(false);
  });
  it('discards recovery without changing a saved exercise',async()=>{
    const before=structuredClone(stored());
    mocks.values.set(workspaceDraftKey(storageKey),{version:1,exercise:{...before.exercises[0],notes:'Unwanted draft'},savedAt:new Date().toISOString()});
    await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));
    await click('Start fresh');
    expect(host.querySelector('[aria-label="Recover workspace draft"]')).toBeNull();
    expect(stored()).toEqual(before);expect(mocks.values.has(workspaceDraftKey(storageKey))).toBe(false);
  });
  it('filters saved pages across folders while keeping preview-first navigation',async()=>{
    await click('Exercise library');await type('[aria-label="Search exercises"]','Original notes');
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(1);
    await click('Open exercise');expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Quadratic page');
    await click('Close',host.querySelector('[role="dialog"]')!);
    await type('[aria-label="Search exercises"]','no matching page');
    expect(host.textContent).toContain('No matching exercises');
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('uses the Mathfolio wordmark, places discussion before notes, and keeps zoom and symbol search local',async()=>{
    expect(host.querySelector('.brand-wordmark')?.textContent).toBe('Mathfolio');
    expect(host.querySelector('.brand')?.textContent).not.toContain('Σ');
    expect([...host.querySelector('.workbench')!.children].map(x=>x.className)).toEqual(['paper discussion','paper notes']);
    await act(async()=>{host.querySelector<HTMLDetailsElement>('.study-options')!.open=true;});
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Increase math size"]')!.click());
    expect(host.querySelector<HTMLElement>('main')!.style.getPropertyValue('--problem-font-size')).toBe('18px');
    const keyboard=host.querySelector('.problem .math-keyboard')!;await click('More symbols',keyboard);
    await type('[aria-label="Search math symbols"]','integral',document);
    expect(document.querySelector('[aria-label="Search results"]')?.textContent).toContain('∫');
    await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(document.querySelector('.symbol-browser')).not.toBeNull();
    await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Close symbol keyboard"]')!.click());
    expect(document.querySelector('.symbol-browser')).toBeNull();
    expect(mocks.ai).not.toHaveBeenCalled();expect(mocks.write).not.toHaveBeenCalled();
  });
  it('does not analyze behind a Save dialog when using Ctrl+Enter',async()=>{
    await type('[aria-label="Problem statement"]','x=1');await click('Save exercise');
    await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true})));
    expect(mocks.ai).not.toHaveBeenCalled();
  });
});
async function uploadImage(){
  const upload=host.querySelector<HTMLInputElement>('[aria-label="Read a problem image"]')!;
  Object.defineProperty(upload,'files',{configurable:true,value:[new File(['image'],'problem.jpg',{type:'image/jpeg'})]});
  await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})));
}
describe('image problem review',()=>{
  it('requires review and confirmation before replacing an analyzed problem; leaves the saved original intact',async()=>{
    await openWorkspace();await uploadImage();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Start with printed text on this device');
    expect(mocks.readImage).not.toHaveBeenCalled();
    mocks.readImage.mockResolvedValue({text:'Solve x+1=2',source:'on_device'});
    await click('Read with AI');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toContain('x+1=2');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('x^2+2x=0');
    await click('Use this problem');
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('clears its essentials');
    await click('Use this problem',host.querySelector('[role="alertdialog"]')!);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toContain('x+1=2');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe(String.raw`\text{Original notes}`);
    expect(host.textContent).not.toContain('Original essentials');
    expect(stored().exercises[0].statement).toBe('x^2+2x=0');
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('prioritizes printed OCR, allows direct math edits, and applies edited TeX without reparsing it',async()=>{
    await uploadImage();mocks.readImage.mockResolvedValue({text:String.raw`Solve \(\frac{x}{2}=3\).`,source:'local_ocr'});
    expect(button('Read printed text').classList.contains('primary')).toBe(true);
    expect(button('Read with AI').classList.contains('primary')).toBe(false);
    await click('Read printed text');expect(mocks.readImage).toHaveBeenCalledWith(expect.anything(),expect.any(Function),expect.any(AbortSignal),true);
    const corrected=String.raw`\class{mathfolio-line}{\text{Corrected }\frac{x+1}{2}=3}`;
    await type('[aria-label="Recognized image problem"]',corrected);
    await click('Use this problem');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe(corrected);
  });
  it('restores the latest image extraction and supports the shared symbol keyboard',async()=>{
    await uploadImage();mocks.readImage.mockResolvedValue({text:'Solve x+1=2',source:'on_device'});
    await click('Read with AI');expect(mocks.readImage.mock.calls[0][3]).toBe(false);
    const original=host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value;
    await type('[aria-label="Recognized image problem"]','CHANGED');await click('Restore extracted text');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toBe(original);
    expect(host.textContent).toContain('Extracted text restored');
    expect(host.querySelector('.image-review-tools .math-keyboard')).not.toBeNull();
  });
  it('opens the source image and closes its viewer without losing the review',async()=>{
    await uploadImage();await type('[aria-label="Recognized image problem"]',String.raw`\text{Keep edits }x=7`);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Enlarge source image: problem.jpg"]')!.click());
    expect(host.querySelector('.image-viewer')).not.toBeNull();expect(host.querySelector<HTMLElement>('.image-backdrop')!.inert).toBe(true);
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(host.querySelector('.image-viewer')).toBeNull();expect(host.querySelector('.image-import-review')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toContain('Keep edits');
  });
  it('asks before sending an image to Cloud AI and enables the session only after consent',async()=>{
    await uploadImage();await type('[aria-label="Recognized image problem"]','Keep this review');
    await chooseOption('Image reading AI','Cloud AI');expect(mocks.imageCloud).not.toHaveBeenCalled();
    await click('Read with AI');expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('Allow Cloud AI and read this image?');
    expect(host.querySelector<HTMLElement>('.image-backdrop')!.inert).toBe(true);
    await click('Not now');expect(mocks.imageCloud).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toBe('Keep this review');
    await click('Read with AI');await click('Allow Cloud AI and read image');
    expect(mocks.imageCloud).toHaveBeenCalledWith('data:image/jpeg;base64,AA==',expect.any(AbortSignal));
    expect(mocks.readImage).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toContain(String.raw`\sqrt{2}`);
    expect(host.querySelector('[role="switch"][aria-label="Cloud AI"]')?.getAttribute('aria-checked')).toBe('true');
    await click('Read with AI');expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('Read this image with Cloud AI?');
    await click('Not now');expect(mocks.imageCloud).toHaveBeenCalledTimes(1);
  });
  it('keeps the review and shows an error when Cloud AI is offline',async()=>{
    await uploadImage();await type('[aria-label="Recognized image problem"]','Kept review');
    vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
    await chooseOption('Image reading AI','Cloud AI');await click('Read with AI');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('internet connection');expect(mocks.imageCloud).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toBe('Kept review');
  });
  it('aborts Cloud image reading and ignores late results after stop and close',async()=>{
    await uploadImage();let finish!:(text:string)=>void;let signal!:AbortSignal;
    mocks.imageCloud.mockImplementation((_:string,stop:AbortSignal)=>{signal=stop;return new Promise(resolve=>{finish=resolve;});});
    await chooseOption('Image reading AI','Cloud AI');await click('Read with AI');await click('Allow Cloud AI and read image');
    await click('Stop reading');expect(signal.aborted).toBe(true);
    await type('[aria-label="Recognized image problem"]','Preserve manual review');
    await act(async()=>finish('LATE CLOUD RESULT'));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toBe('Preserve manual review');
    await click('Read with AI');await click('Send image to Cloud AI');await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close image import"]')!.click());
    expect(signal.aborted).toBe(true);await act(async()=>finish('LATE CLOSED RESULT'));
    expect(host.querySelector('.image-import-review')).toBeNull();expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('');
  });
  it.each(['', 'x'.repeat(6001)])('keeps manual review when recognition is empty or too long (%#. result)',async text=>{
    await uploadImage();await type('[aria-label="Recognized image problem"]','Keep manual review');
    mocks.readImage.mockResolvedValue({text,source:'local_ocr'});await click('Read printed text');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toBe('Keep manual review');
    expect(button('Use this problem').disabled).toBe(false);
  });
  it('confirms before replacing chat on an unanalyzed problem',async()=>{
    mocks.ai.mockResolvedValue({text:'Try the definition.',source:'on_device'});
    await type('[aria-label="Discussion question"]',String.raw`\text{How should I begin?}`);await click('Send');
    await uploadImage();await type('[aria-label="Recognized image problem"]','New problem');await click('Use this problem');
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('clears its essentials, hints and chat');
    await click('Keep working');expect(host.textContent).toContain('How should I begin?');expect(host.querySelector('.image-import-review')).not.toBeNull();
  });
  it('stops image reading, ignores late results, and never applies anything when closing',async()=>{
    await uploadImage();let finish!:(result:{text:string;source:string})=>void;let signal!:AbortSignal;
    mocks.readImage.mockImplementation((_:unknown,__:unknown,stop:AbortSignal)=>{signal=stop;return new Promise(resolve=>{finish=resolve;});});
    await click('Read with AI');await click('Stop reading');
    expect(signal.aborted).toBe(true);
    await act(async()=>finish({text:'LATE IMAGE RESULT',source:'on_device'}));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Recognized image problem"]')!.value).toBe('');
    await click('Cancel',host.querySelector('[role="dialog"]')!);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('');
    expect(mocks.write).not.toHaveBeenCalled();
  });
});

describe('manual illustration drawing',()=>{
  async function drawPoint(){await click('Draw illustration');await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Start with coordinate plane"]')!.click());await type('[aria-label="Point name"]','A');await type('[aria-label="Point x"]','-2');await type('[aria-label="Point y"]','3');await click('Add point');}
  it('starts with a choice and restricts coordinate tools to the selected mode',async()=>{
    await click('Draw illustration');expect(host.querySelector('.drawing-canvas')).toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Start with blank canvas"]')!.click());
    expect(host.querySelector('.drawing-canvas')).not.toBeNull();expect(host.querySelector('[aria-label="Point x"]')).toBeNull();expect(host.querySelector('[aria-label="Equation 1"]')).toBeNull();
    await click('Coordinate plane');expect(host.querySelector('[aria-label="Equation 1"]')).not.toBeNull();expect(host.querySelector('[aria-label="Point x"]')).not.toBeNull();
    expect(host.textContent).not.toContain('Select area');expect(host.querySelector('.drawing-selection-actions [aria-label="Delete selected objects"]')).not.toBeNull();
    await click('Blank canvas');expect(host.querySelector('[aria-label="Equation 1"]')).toBeNull();
  });
  it('offers free equation rows, supported keys and parameter sliders',async()=>{
    await click('Draw illustration');await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Start with coordinate plane"]')!.click());
    const sidebar=host.querySelector('.drawing-sidebar')!;
    expect(sidebar.firstElementChild?.textContent).toBe('Snap to gridGridAxes');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Equation 1"]')!.value).toBe('');
    const keys=host.querySelector('[aria-label="Equation math keyboard"]')!;
    expect(keys.textContent).not.toMatch(/[∅∈∫ℝΣ]/);expect(keys.textContent).toContain('sin');
    await type('[aria-label="Equation 1"]','x-y=b');await click('Add slider for b');
    expect(host.querySelector('[aria-label="Slider b"]')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Equation 2"]')!.value).toBe('b=1');
    expect(host.querySelector('.equation-error')).toBeNull();
    await type('[aria-label="Slider b"]','-3.13');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Equation 2"]')!.value).toBe('b=-3.13');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Remove expression 2"]')!.click());expect(host.querySelector('.equation-error')?.textContent).toContain('Define b');
  });
  it('allows manual sketches in Focus and persists their exclusion from AI without clearing guidance',async()=>{
    await openWorkspace();await click('Focus mode');
    const illustrations=host.querySelector('.problem-images')!;
    expect(illustrations.querySelector('[aria-label="Attach a problem illustration"]')).not.toBeNull();
    expect(illustrations.textContent).not.toMatch(/FOR AI|Cloud AI|Use this illustration for AI/);
    await drawPoint();await click('Add to illustrations');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(illustrations.querySelectorAll('img')).toHaveLength(1);
    expect(illustrations.querySelector('input[type="checkbox"]')).toBeNull();
    await click('Exit focus mode');
    expect(illustrations.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    expect(host.textContent).toContain('Original essentials');expect(host.textContent).toContain('Original hint');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toContain('Original notes');
    await click('Save exercise');
    expect(stored().exercises.find(item=>item.id==='first')!.attachments.find(image=>image.kind==='problem')).toMatchObject({useForAI:false});
    mocks.ai.mockResolvedValue({text:'Reply',source:'on_device'});
    await type('[aria-label="Discussion question"]','Explain');await click('Send');
    expect(mocks.ai).toHaveBeenLastCalledWith(expect.objectContaining({images:[]}),expect.any(Function),expect.any(AbortSignal));
  });
  it('uploads and views images in Focus without AI selection or clearing analyzed context',async()=>{
    await openWorkspace();await click('Focus mode');const upload=host.querySelector<HTMLInputElement>('[aria-label="Attach a problem illustration"]')!;
    Object.defineProperty(upload,'files',{configurable:true,value:[new File(['image'],'Focus photo.png',{type:'image/png'})]});
    await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})));
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();expect(host.textContent).toContain('Original essentials');
    expect(host.querySelector('.problem-images input[type="checkbox"]')).toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="View image: Focus photo.png"]')!.click());expect(host.querySelector('.image-viewer')).not.toBeNull();
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    await click('Exit focus mode');expect(host.querySelector<HTMLInputElement>('.problem-images input[type="checkbox"]')!.checked).toBe(false);
    await click('Save exercise');expect(stored().exercises.find(item=>item.id==='first')!.attachments.find(image=>image.kind==='problem')).toMatchObject({useForAI:false,name:'Focus photo.png'});
    expect(mocks.ai).not.toHaveBeenCalled();expect(mocks.imageCloud).not.toHaveBeenCalled();expect(mocks.imageLocal).not.toHaveBeenCalled();
  });
  async function sketchFrom(trigger:string,action:string,scope:ParentNode=host){await click(trigger,scope);await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Start with coordinate plane"]')!.click());await type('[aria-label="Point x"]','2');await click('Add point');await click(action);}
  it('attaches drawings to notes and saved-note previews without changing AI context',async()=>{
    await openWorkspace();await sketchFrom('Draw in notes','Attach to notes');
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();expect(host.textContent).toContain('Original essentials');expect(host.querySelectorAll('.notes img')).toHaveLength(2);expect(host.querySelectorAll('.problem-images img')).toHaveLength(0);
    await click('Save exercise');expect(stored().exercises[0].attachments.at(-1)).toMatchObject({kind:'solution',name:'My illustration.png'});
    await click('Exercise library');await click('All exercises');await click('Open exercise');await sketchFrom('Draw in notes','Attach to notes',host.querySelector('.exercise-preview')!);
    expect(host.querySelector('.exercise-preview')?.hasAttribute('inert')).toBe(false);await click('Save changes');expect(stored().exercises[0].attachments.filter(a=>a.kind==='solution')).toHaveLength(3);
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('keeps chat drawings in the composer on stop/error, then saves them with exactly the sent message',async()=>{
    await openWorkspace();await sketchFrom('Draw for chat','Add to message');expect(mocks.ai).not.toHaveBeenCalled();expect(host.querySelectorAll('.problem-images img')).toHaveLength(0);expect(host.querySelectorAll('.notes img')).toHaveLength(1);
    let finish!:(answer:Answer)=>void;mocks.ai.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));await click('Send');await click('■ Stop AI');
    await act(async()=>finish({text:'LATE DRAWING ANSWER',source:'on_device'}));expect(host.querySelector('.messages')?.textContent).not.toContain('LATE DRAWING ANSWER');expect(host.querySelectorAll('.discussion>.attachments img')).toHaveLength(1);
    mocks.ai.mockRejectedValueOnce(new Error('Try again'));await click('Send');expect(host.querySelectorAll('.discussion>.attachments img')).toHaveLength(1);
    mocks.ai.mockResolvedValueOnce({text:'Check the added line',source:'on_device'});await type('[aria-label="Discussion question"]','Does this work?');await click('Send');
    expect(mocks.ai.mock.calls.at(-1)![0]).toMatchObject({purpose:'chat',images:[],messageImages:[{name:'My illustration.png'}]});expect(host.querySelectorAll('.messages .attachments img')).toHaveLength(1);expect(host.querySelectorAll('.discussion>.attachments img')).toHaveLength(0);
    await click('Save exercise');const messages=stored().exercises.find(e=>e.id==='first')!.messages;expect(messages.at(-2)).toMatchObject({role:'user',text:'Does this work?',images:[{name:'My illustration.png'}]});expect(messages.at(-1)).toMatchObject({role:'assistant',text:'Check the added line'});
    await click('Exercise library');await click('All exercises');await click('Open exercise');expect(host.querySelectorAll('.exercise-preview .message img')).toHaveLength(1);
  });
  it('attaches an exported drawing as a problem illustration and keeps notes',async()=>{
    await type('[aria-label="Notes"]',String.raw`\text{Keep my notes}`);await drawPoint();await type('[aria-label="Drawing image name"]','My construction');
    await click('Add to illustrations');expect(host.querySelector('.drawing-dialog')).toBeNull();
    expect(host.querySelector('.problem-images')?.textContent).toContain('My construction.png');expect(host.querySelector('.notes')?.textContent).not.toContain('My construction.png');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toContain('Keep my notes');expect(mocks.ai).not.toHaveBeenCalled();
    expect(mocks.drawingExport).toHaveBeenCalledWith(expect.anything(),expect.any(AbortSignal));
  });
  it('retains the drawing after closing and cancelling an analyzed-context replacement',async()=>{
    await openWorkspace();await drawPoint();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close drawing"]')!.click());
    await click('Draw illustration');expect(host.querySelector('.drawing-object-list')?.textContent).toContain('A');await click('Add to illustrations');
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('Update problem illustrations?');expect(host.querySelector<HTMLElement>('.drawing-backdrop')!.inert).toBe(true);
    await click('Keep working');expect(host.querySelector('.drawing-dialog')).not.toBeNull();expect(host.textContent).toContain('Original essentials');
    await click('Add to illustrations');await click('Update illustrations');expect(host.querySelector('.drawing-dialog')).toBeNull();expect(host.textContent).not.toContain('Original essentials');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toContain('Original notes');
  });
  it('clears unattached drawing drafts when changing exercise and respects the four-image limit',async()=>{
    await drawPoint();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close drawing"]')!.click());await click('＋ New exercise');await click('Draw illustration');
    expect(host.querySelector('.drawing-mode-choice')).not.toBeNull();await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close drawing"]')!.click());
    stored().exercises[0].attachments=Array.from({length:4},(_,i)=>({id:String(i),name:`image${i}.png`,kind:'problem',data:'data:image/png;base64,AA=='}));
    await act(async()=>{root.unmount();root=createRoot(host);root.render(<App/>);});await openWorkspace();expect(button('Draw illustration').disabled).toBe(true);
  });
  it('shows export errors in the drawing dialog and keeps the work',async()=>{
    await drawPoint();mocks.drawingExport.mockRejectedValueOnce(new Error('Image export failed'));await click('Add to illustrations');
    expect(host.querySelector('.drawing-dialog [role="alert"]')?.textContent).toContain('Image export failed');expect(host.querySelector('.drawing-object-list')?.textContent).toContain('A');
    expect(button('Add to illustrations').disabled).toBe(false);
  });
});

describe('attachment zoom viewer across workspace and library',()=>{
  it('opens a saved attachment over the library preview and returns without losing unsaved notes',async()=>{
    await library();await click('Open exercise');await type('[aria-label="Saved exercise notes"]','Keep unsaved notes');
    const thumbnail=host.querySelector<HTMLButtonElement>('[aria-label="View image: solution.png"]')!;
    await act(async()=>{thumbnail.focus();thumbnail.click();});
    expect(host.querySelector('.image-viewer')).not.toBeNull();expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    expect(host.querySelector('.exercise-backdrop')?.hasAttribute('inert')).toBe(true);expect(document.body.style.overflow).toBe('hidden');
    await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
    expect(host.querySelector('.image-viewer')).toBeNull();expect(host.querySelector('.exercise-preview')).not.toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Saved exercise notes"]')!.value).toBe('Keep unsaved notes');expect(document.activeElement).toBe(thumbnail);
    expect(document.body.style.overflow).toBe('hidden');expect(stored().exercises[0].notes).toBe('Original notes');expect(mocks.write).not.toHaveBeenCalled();
    await click('Close',host.querySelector('.exercise-preview')!);await click('Discard changes & continue');expect(document.body.style.overflow).toBe('');
  });
  it('opens workspace solution images locally and blocks save/analyze shortcuts behind the viewer',async()=>{
    await openWorkspace();const before=structuredClone(stored());
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="View image: solution.png"]')!.click());
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(true);
    for(const key of ['s','Enter'])await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true})));
    expect(mocks.ai).not.toHaveBeenCalled();expect(mocks.write).not.toHaveBeenCalled();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close image viewer"]')!.click());
    expect(host.querySelector('main')?.hasAttribute('inert')).toBe(false);expect(stored()).toEqual(before);expect(document.body.style.overflow).toBe('');
  });
  it('uses the same popup for source problem images',async()=>{
    stored().exercises[0].attachments.push({id:'problem-image',name:'question.png',kind:'problem',data:'data:image/png;base64,AA=='});
    await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));await openWorkspace();
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="View image: question.png"]')!.click());
    expect(host.querySelector('.image-viewer-header')?.textContent).toContain('PROBLEM IMAGE');expect(host.querySelector('.image-viewer-header')?.textContent).toContain('question.png');expect(mocks.ai).not.toHaveBeenCalled();
  });
});
async function withDiagram(){
  stored().exercises[0].attachments.push({id:'diagram',name:'triangle.png',data:'data:image/png;base64,AA==',kind:'problem'});
  await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App/>));await openWorkspace();
}
describe('new workspace rows and selected visual context',()=>{
  it('places problem/images, knowledge/hints and discussion/notes in three separate rows',()=>{
    expect([...host.querySelector('.problem-row')!.children].map(node=>node.className)).toEqual(['paper problem','paper problem-images']);
    expect([...host.querySelector('.guidance-row')!.children].map(node=>node.className)).toEqual(['paper knowledge','paper hints']);
    expect([...host.querySelector('.workbench')!.children].map(node=>node.className)).toEqual(['paper discussion','paper notes']);
  });
  it('includes selected diagrams on every AI request while excluding solution images',async()=>{
    await withDiagram();mocks.ai.mockResolvedValue({text:'Read the marked dimensions.',source:'on_device'});
    await click('Refresh knowledge');
    expect(mocks.ai.mock.calls[0][0].images).toEqual([{name:'triangle.png',data:'data:image/png;base64,AA=='}]);
    await type('[aria-label="Discussion question"]',String.raw`\text{Why is }a^2+b^2=c^2`);await click('Send');
    expect(mocks.ai.mock.calls[1][0]).toMatchObject({purpose:'chat',route:'local',images:[{name:'triangle.png'}]});
    expect(host.querySelector('[aria-label="Your question"]')).not.toBeNull();expect(stored().exercises[0].messages).toHaveLength(1);
  });
  it('requires confirmation before excluding an illustration and clears old tutoring only after acceptance',async()=>{
    await withDiagram();const checkbox=host.querySelector<HTMLInputElement>('.image-ai-choice input')!;
    await act(async()=>checkbox.click());expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();await click('Keep working');
    expect(checkbox.checked).toBe(true);expect(host.textContent).toContain('Original essentials');
    await act(async()=>checkbox.click());await click('Update illustrations');
    expect(checkbox.checked).toBe(false);expect(host.textContent).not.toContain('Original essentials');expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.readOnly).toBe(false);
    expect(stored().exercises[0].attachments.find(image=>image.id==='diagram')!.useForAI).toBeUndefined();
    mocks.ai.mockResolvedValue({text:'Text-only context',source:'on_device'});await click('Confirm & analyze');expect(mocks.ai.mock.calls[0][0].images).toEqual([]);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe(String.raw`\text{Original notes}`);
  });
  it('discloses illustration sharing but keeps a visual first hint local after cloud approval',async()=>{
    stored().exercises[0].hints=[];await withDiagram();mocks.ai.mockResolvedValue({text:'Use the labelled angle',source:'in_cloud'});
    await click('Cloud AI',host.querySelector('.workspace-actions')!);expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain('selected problem illustrations');expect(mocks.ai).not.toHaveBeenCalled();
    await click('Allow Cloud AI');await click('Open level 1');expect(mocks.ai.mock.calls[0][0]).toMatchObject({purpose:'hint1',route:'local',cloudAllowed:true,images:[{name:'triangle.png'}]});
  });
  it('does not run AI for an empty rich chat question or when searching symbols with Ctrl+Enter',async()=>{
    await openWorkspace();await type('[aria-label="Discussion question"]',String.raw`\text{   }`);expect(button('Send').disabled).toBe(true);
    await click('Workspace');await click('Show math keyboard');await click('More symbols',host.querySelector('.notes')!);
    const search=document.querySelector<HTMLInputElement>('[aria-label="Search math symbols"]')!;
    await act(async()=>search.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',ctrlKey:true,bubbles:true,cancelable:true})));
    expect(mocks.ai).not.toHaveBeenCalled();
  });
});

describe('library browsing improvements',()=>{
  it('shows all exercises directly and restores results after clearing a search',async()=>{
    await click('Exercise library');await click('All exercises',host.querySelector('.library-view')!);
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(2);
    expect(host.querySelector('.library-results')?.textContent).toContain('2 of 2 exercises');
    await type('[aria-label="Search exercises"]','nothing matches');
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(0);
    expect(host.querySelector('.library-results')?.textContent).toContain('0 of 2 exercises');
    await click('Clear filters');
    expect(host.querySelectorAll('.exercise-card')).toHaveLength(2);
    await click('Folders',host.querySelector('.library-view')!);
    expect(host.querySelector('.folder-grid')).not.toBeNull();
    expect(mocks.write).not.toHaveBeenCalled();expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('makes sorting from the folder overview immediately show ordered exercises',async()=>{
    await click('Exercise library');
    const select=host.querySelector<HTMLSelectElement>('[aria-label="Sort exercises"]')!;
    await act(async()=>{select.value='oldest';select.dispatchEvent(new Event('change',{bubbles:true}));});
    expect([...host.querySelectorAll('.exercise-card h2')].map(e=>e.textContent)).toEqual(['Second page','Quadratic page']);
    expect(host.querySelector('nav [aria-current="page"]')?.textContent).toContain('Exercise library');
  });
});

describe('workspace comfort and English guide',()=>{
  it('opens the English guide without losing a draft and returns to work',async()=>{
    await type('[aria-label="Problem statement"]','2x+3=7');
    await click('How to use');
    expect(host.querySelector('#guide-title')?.textContent).toBe('How to use Mathfolio');
    expect(host.querySelector('nav [aria-current="page"]')?.textContent).toBe('How to use');
    await click('Go to workspace');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toBe('2x+3=7');
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('keeps PDF and image imports inside Problem in both workspace modes',async()=>{
    expect(host.querySelector('.workspace-toolbar .import-actions')).toBeNull();
    for(const focus of [false,true]){
      if(focus)await click('Focus mode');
      const menu=host.querySelector('.problem .problem-import')!;
      expect(menu.querySelector('[aria-label="Choose a PDF"]')).not.toBeNull();
      expect(menu.querySelector('[aria-label="Read a problem image"]')).not.toBeNull();
    }
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('toggles focus without discarding notes or requesting AI',async()=>{
    await type('[aria-label="Notes"]','My approach');await click('Focus mode');
    expect(host.querySelector('.workspace-content')?.classList.contains('focus-mode')).toBe(true);
    await click('Exit focus mode');
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Notes"]')!.value).toBe('My approach');
    expect(mocks.ai).not.toHaveBeenCalled();
  });
  it('passes answer style to new local requests',async()=>{
    await act(async()=>host.querySelector<HTMLElement>('.study-options summary')!.click());
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Local answer style"]')!.click());
    await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(item=>item.textContent?.includes('Brief'))!.click());
    await type('[aria-label="Problem statement"]','2x+3=7');mocks.ai.mockResolvedValue({text:'Formula',source:'on_device'});
    await click('Confirm & analyze');expect(mocks.ai.mock.calls[0][0]).toMatchObject({responseStyle:'brief',route:'local'});
  });
  it('applies and persists reading appearance preferences',async()=>{
    await act(async()=>{host.querySelector<HTMLElement>('.appearance-disclosure summary')!.click();});
    async function choose(label:string,option:string){await act(async()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());if(label==='Theme')expect([...document.querySelectorAll('[role="option"]')].map(item=>item.textContent?.replace('✓','').trim())).toEqual(['Light','Dark']);await act(async()=>[...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(item=>item.textContent?.trim().startsWith(option))!.click());}
    await choose('Theme','Dark');await choose('Reading font','Book serif');await choose('Text color','Blue');expect(host.querySelector('[aria-label="Text alignment"]')).toBeNull();
    await type('.appearance-size input','19');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.readingFont).toBe('serif');
    expect(document.documentElement.dataset.ink).toBe('blue');
    expect(document.documentElement.dataset.readingAlign).toBe('left');
    expect(document.documentElement.style.getPropertyValue('--reading-size')).toBe('19px');
    expect(host.querySelector<HTMLElement>('.appearance-preview p')!.style.fontSize).toBe('19px');
    expect(host.querySelector<HTMLElement>('.appearance-preview')!.classList.contains('preview-paper')).toBe(true);
    expect(JSON.parse(localStorage.getItem('mathfolio-appearance-v1')!)).toMatchObject({theme:'dark',font:'serif',textColor:'blue',textSize:19});
  });
  it('accepts geometry directly and offers manual illustrations instead of generated diagrams',async()=>{
    expect(host.textContent).not.toContain('Geometry studio');expect(host.textContent).not.toContain('Create diagram');
    await type('[aria-label="Problem statement"]','Prove that ABCD is cyclic.');
    expect(button('Draw illustration').disabled).toBe(false);expect(mocks.diagram).not.toHaveBeenCalled();
    await click('Draw illustration');expect(host.querySelector('[aria-labelledby="drawing-title"]')).not.toBeNull();
    expect(host.querySelector<HTMLElement>('main')!.inert).toBe(true);
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Close drawing"]')!.click());
    expect(host.querySelector('[aria-labelledby="drawing-title"]')).toBeNull();
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Problem statement"]')!.value).toContain('ABCD');
  });
  it('provides common symbols in chat and toggles the expanded keyboard with its trigger',async()=>{
    const keyboard=host.querySelector('.discussion .math-keyboard')!;
    expect(keyboard.querySelectorAll('.math-keys button').length).toBeGreaterThan(10);
    await click('More symbols',keyboard);expect(document.querySelector('.symbol-browser')).not.toBeNull();
    await click('Math symbols',keyboard);expect(document.querySelector('.symbol-browser')).toBeNull();
    expect(mocks.ai).not.toHaveBeenCalled();
  });
});
