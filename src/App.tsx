import { useEffect, useRef, useState } from 'react';
import { friendlyError, prepareLocal, study, type StudyMetrics, type StudyUpdate } from './ai';
import { MarkdownView } from './components/MarkdownView';
import { extractPdf } from './pdf';
import { samples } from './samples';
import { contextFor } from './context';
import { DocumentLibrary } from './components/DocumentLibrary';
import { downloadMarkdown, loadNotes, persistNotes } from './storage';
import type { Action, Language, Policy, SavedNote, StudyResult, Subject } from './types';
export default function App() {
const [subject, setSubject] = useState<Subject>('calculus');
const [language, setLanguage] = useState<Language>('vi');
const [document, setDocument] = useState(samples.calculus);
const [documentTitle, setDocumentTitle] = useState('Tài liệu mẫu / Sample');
const [sourcePage, setSourcePage] = useState<number>();
const [answerMode, setAnswerMode] = useState<'grounded' | 'expanded'>('grounded');
const [excerpt, setExcerpt] = useState('');
const [context, setContext] = useState('');
const [question, setQuestion] = useState('');
const [policy, setPolicy] = useState<Policy>('local');
const [result, setResult] = useState<StudyResult>();
const [partial, setPartial] = useState<StudyUpdate>();
const [metrics, setMetrics] = useState<StudyMetrics>();
const [busy, setBusy] = useState(false);
const [status, setStatus] = useState('');
const [error, setError] = useState('');
const [notes, setNotes] = useState<SavedNote[]>([]);
const [notesReady, setNotesReady] = useState(false);
const [revealed, setRevealed] = useState(false);
const [answers, setAnswers] = useState<Record<number, number>>({});
const readerRef = useRef<HTMLDivElement>(null);
const readerVersion = useRef(0);
useEffect(() => {
loadNotes().then(setNotes).catch(() => setError('Không đọc được IndexedDB; kiểm tra quyền lưu trữ.'))
.finally(() => setNotesReady(true));
}, []);
function captureSelection() {
if (busy) return;
const selection = window.getSelection();
if (!selection || !readerRef.current?.contains(selection.anchorNode) || !readerRef.current.contains(selection.focusNode)) return;
const text = selection.toString().trim();
if (text) { setExcerpt(text.slice(0, 6000)); setResult(undefined); useContext(text.slice(0, 6000)); }
}
function useContext(value = excerpt) {
const slice = contextFor(document, value); setContext(slice.context); setSourcePage(slice.page);
setStatus(slice.found ? 'Đã lấy ngữ cảnh quanh đoạn. Hãy xem lại trước khi gửi.' : 'Không định vị chính xác hoặc đoạn xuất hiện nhiều lần. Hãy nhập ngữ cảnh và kiểm tra ký hiệu.');
}
function clearReader() {
readerVersion.current++;
setPartial(undefined); setMetrics(undefined);
setDocument(''); setDocumentTitle(''); setExcerpt(''); setContext(''); setSourcePage(undefined); setResult(undefined);
}
async function run(action: Action) {
if (busy) return;
setBusy(true); setError(''); setStatus('Đang xử lý / Working…');
setResult(undefined); setPartial(undefined); setMetrics(undefined); setRevealed(false); setAnswers({});
const version = readerVersion.current;
try {
const value = await study({ subject, language, excerpt, context, question, action, policy, answerMode, documentTitle, sourcePage },
p => { if (version === readerVersion.current) setStatus(`Chuẩn bị mô hình / Preparing model: ${Math.round(p * 100)}%`); },
update => {
  if (version !== readerVersion.current) return;
  setPartial(update); setStatus('Đang trả lời / Answering…');
});
if (version === readerVersion.current) {
  setPartial(undefined); setResult(value); setMetrics(value.metrics); setStatus('Hoàn tất / Done');
}
} catch (e) {
  if (version === readerVersion.current) {
    setPartial(undefined); setMetrics(undefined); setError(friendlyError(e)); setStatus('');
  }
}
finally { setBusy(false); }
}
async function prepare() {
setBusy(true); setError(''); setStatus('Chuẩn bị mô hình / Preparing model…');
try {
await prepareLocal(language, p => setStatus(`Model: ${Math.round(p * 100)}%`));
setStatus('Mô hình đã chuẩn bị. Hãy chạy và kiểm tra nguồn xử lý. / Model initialized.');
} catch (e) { setError(friendlyError(e)); }
finally { setBusy(false); }
}
async function importFile(file?: File, importedSubject?: Subject) {
if (!file) return;
setBusy(true); setError('');
try {
const text = file.name.toLowerCase().endsWith('.pdf') ? await extractPdf(file) : await file.text();
if (text.length > 150000 || file.size > 10 * 1024 * 1024) throw new Error('Tài liệu quá lớn cho bản mẫu.');
setDocument(text); setDocumentTitle(file.name.slice(0, 200)); setExcerpt(''); setContext(''); setSourcePage(undefined); setResult(undefined);
if (importedSubject) setSubject(importedSubject);
setStatus('Đã mở tại máy. Kiểm tra ký hiệu trước khi hỏi AI. / Opened locally; review extracted symbols.');
} catch (e) { setError(friendlyError(e)); }
finally { setBusy(false); }
}
async function save() {
if (!result || !notesReady) return;
const note: SavedNote = { id: crypto.randomUUID(), title: excerpt.slice(0, 80), subject,
excerpt, documentTitle, sourcePage, markdown: result.markdown, createdAt: new Date().toISOString() };
try { const next = [note, ...notes]; await persistNotes(next); setNotes(next); setStatus('Đã lưu tại máy / Saved locally.'); }
catch { setError('Không lưu được. Hãy xuất file Markdown. / Export Markdown instead.'); }
}
async function remove(id: string) {
try { const next = notes.filter(n => n.id !== id); await persistNotes(next); setNotes(next); }
catch { setError('Không xóa được ghi chú / Could not delete note.'); }
}
return <main>
<header><h1>StudyLens</h1><p>Đọc • Hiểu • Tự kiểm tra / Read • Understand • Practice</p></header>
<div className="toolbar">
<label>Môn / Course <select disabled={busy} value={subject} onChange={e => {
const s = e.target.value as Subject; setSubject(s); setDocument(samples[s]);
setDocumentTitle('Tài liệu mẫu / Sample'); setExcerpt(''); setContext(''); setSourcePage(undefined); setResult(undefined);
}}><option value="calculus">Giải tích 1A / Calculus</option><option value="discrete">Toán rời rạc 1A / Discrete Math</option><option value="algorithms">Thuật toán / Algorithms</option></select></label>
<label>Trả lời / Answer <select disabled={busy} value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="vi">Tiếng Việt (cần kiểm thử trên máy)</option><option value="en">English</option></select></label>
<label>Mở / Open .pdf .md .txt <input disabled={busy} type="file" accept=".pdf,.md,.txt" onChange={e => { void importFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
<button disabled={busy} onClick={() => void prepare()}>Chuẩn bị AI tại máy / Prepare local AI</button>
</div>
<p className="notice">Chế độ mặc định chỉ suy luận tại máy. App Check có thể cần kết nối khi thiết lập. Chỉ dùng tài liệu bạn có quyền sử dụng. / Inference is local by default; initial setup may need connectivity.</p>
<DocumentLibrary subject={subject} parentBusy={busy} onOpen={importFile} onSessionChange={clearReader} />
<section className="columns">
<div>
<h2>Tài liệu / Document</h2><p>{documentTitle}{sourcePage ? ` · Trang / Page ${sourcePage}` : ''}</p>
<div ref={readerRef} onMouseUp={captureSelection} onKeyUp={captureSelection} className="reader"><MarkdownView value={document} /></div>
<details><summary>Sửa nội dung / Edit document text</summary><textarea aria-label="Document text" value={document} disabled={busy} onChange={e => { setDocument(e.target.value.slice(0, 150000)); setExcerpt(''); setContext(''); setSourcePage(undefined); setResult(undefined); }} /></details>
</div>
<div>
<h2>Hỏi theo đoạn / Ask about an excerpt</h2>
<label>Đoạn chọn hoặc nhập LaTeX / Excerpt or LaTeX<textarea aria-label="Excerpt" disabled={busy} maxLength={6000} value={excerpt} onChange={e => { setExcerpt(e.target.value); setContext(''); setSourcePage(undefined); setResult(undefined); }} placeholder="Bôi đen ở bên trái hoặc dán nội dung / Select or paste text" /></label>
<button disabled={busy || !excerpt.trim()} onClick={() => useContext()}>Lấy ngữ cảnh quanh đoạn / Get nearby context</button>
<label>Chế độ trả lời / Answer policy<select disabled={busy} value={answerMode} onChange={e => setAnswerMode(e.target.value as 'grounded' | 'expanded')}><option value="grounded">Theo đoạn tài liệu / Grounded in excerpt</option><option value="expanded">Giải thích mở rộng / Expanded explanation</option></select></label>
<label>Ngữ cảnh bổ sung / Additional context<textarea aria-label="Context" disabled={busy} maxLength={6000} value={context} onChange={e => { setContext(e.target.value); setSourcePage(undefined); }} /></label>
<label>Câu hỏi / Question<input disabled={busy} maxLength={1000} value={question} onChange={e => setQuestion(e.target.value)} /></label>
<label className="consent"><input disabled={busy} type="checkbox" checked={policy === 'hybrid'} onChange={e => setPolicy(e.target.checked ? 'hybrid' : 'local')} />Cho phép gửi đoạn chọn, ngữ cảnh và câu hỏi lên cloud khi local không khả dụng hoặc tôi chọn tính năng cloud. / Allow cloud processing.</label>
<details><summary>Xem dữ liệu có thể gửi / Review request data</summary><pre>{JSON.stringify({ documentTitle, sourcePage, excerpt, context, question, subject, language, answerMode }, null, 2)}</pre></details>
<div className="actions">
<button disabled={busy || !excerpt.trim()} onClick={() => void run('quick')}>Giải thích nhanh / Quick</button>
<button disabled={busy || !excerpt.trim()} onClick={() => void run('hint')}>Gợi ý / Hint</button>
<button disabled={busy || !excerpt.trim() || policy !== 'hybrid'} onClick={() => void run('deep')}>Tìm hiểu sâu · Cloud</button>
<button disabled={busy || !excerpt.trim() || policy !== 'hybrid'} onClick={() => void run('quiz')}>3 câu tự kiểm tra · Cloud</button>
</div>
<p role="status">{status}</p>{error && <p role="alert" className="error">{error}</p>}
{partial && <article aria-busy="true">
<p>Câu trả lời chưa hoàn tất / Answer in progress</p>
<p className="badge">{partial.source === 'UNKNOWN' ? 'Đang xác nhận nguồn / Confirming source' : partial.source} · Chữ đầu tiên / First text: {(partial.firstTextMs / 1000).toFixed(2)} s</p>
<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{partial.markdown}</div>
</article>}
{result && <article>
<p>Nguồn đoạn chọn / Selected source: {documentTitle}{sourcePage ? ` · Trang / Page ${sourcePage}` : ''}. AI chỉ nhận đoạn và ngữ cảnh đã xem trước.</p>
<p className="badge">{result.source} · {(result.durationMs / 1000).toFixed(2)} s</p>
{metrics && <p>
Chuẩn bị local / Local preparation: {metrics.initializationMs === undefined ? 'chạy song song / concurrent' : `${(metrics.initializationMs / 1000).toFixed(2)} s`}
{' · '}Chữ đầu tiên từ lúc bấm / First text since click: {metrics.firstTextMs === undefined ? 'không đo cho Quiz / not measured for Quiz' : `${(metrics.firstTextMs / 1000).toFixed(2)} s`}
{' · '}Xử lý / Generation: {(metrics.generationMs / 1000).toFixed(2)} s
</p>}
<p>Giải thích do AI tạo; đối chiếu giả thiết và kiểm tra lại phép biến đổi. / AI explanation: verify assumptions and steps.</p>
{result.quiz ? <div>{result.quiz.map((q, i) => <fieldset key={i}><legend>Câu / Question {i + 1}</legend>
<MarkdownView value={q.questionMarkdown} />
{q.options.map((option, j) => <label className="choice" key={j}><input type="radio" name={`q-${i}`} checked={answers[i] === j} onChange={() => setAnswers({ ...answers, [i]: j })} /><MarkdownView value={`${String.fromCharCode(65 + j)}. ${option}`} /></label>)}
{revealed && <><p>{answers[i] === q.correctIndex ? 'Đúng / Correct' : `Đáp án / Answer: ${String.fromCharCode(65 + q.correctIndex)}`}</p><MarkdownView value={q.explanationMarkdown} /></>}
</fieldset>)}<button onClick={() => setRevealed(true)}>Xem đáp án / Reveal answers</button></div> : <MarkdownView value={result.markdown} />}
<div className="actions"><button disabled={!notesReady} onClick={() => void save()}>Lưu tại máy / Save locally</button><button onClick={() => downloadMarkdown(result.markdown)}>Xuất Markdown</button></div>
</article>}
</div>
</section>
<section><h2>Thư viện ghi chú tại máy / Local notes</h2>
<p>File gốc chỉ được lưu cloud khi bạn dùng nút tải lên thư viện và đồng ý. Ghi chú bên dưới lưu riêng tại trình duyệt, chưa tách theo tài khoản; trên máy chung hãy xuất và xóa ghi chú cá nhân trước khi rời đi.</p>
{notes.map(n => <details key={n.id}><summary>{n.title}</summary><p>{n.createdAt}</p><blockquote>{n.excerpt}</blockquote><MarkdownView value={n.markdown} /><button onClick={() => downloadMarkdown(n.markdown)}>Xuất / Export</button><button onClick={() => void remove(n.id)}>Xóa / Delete</button></details>)}
</section>
</main>;
}
