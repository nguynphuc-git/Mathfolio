import { getAI, GoogleAIBackend, getGenerativeModel, InferenceMode, Schema } from 'firebase/ai';
import { getFirebaseApp } from './firebase';
import { buildPrompt, quizToMarkdown, validateRequest } from './prompt';
import type { QuizItem, StudyRequest, StudyResult } from './types';
const quizSchema = Schema.object({ properties: {
questions: Schema.array({ items: Schema.object({ properties: {
questionMarkdown: Schema.string(), options: Schema.array({ items: Schema.string() }),
correctIndex: Schema.integer(), explanationMarkdown: Schema.string()
} }) })
} });
const models = new Map<string, ReturnType<typeof getGenerativeModel>>();
function modelFor(r: Pick<StudyRequest, 'action' | 'policy' | 'language'>) {
const mode = r.action === 'deep' || r.action === 'quiz'
? InferenceMode.ONLY_IN_CLOUD
: r.policy === 'local' ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_ON_DEVICE;
const key = `${mode}:${r.action === 'quiz' ? 'quiz' : 'text'}:${r.language}`;
let model = models.get(key);
if (!model) {
const ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
model = getGenerativeModel(ai, {
mode,
inCloudParams: {
model: import.meta.env.VITE_CLOUD_MODEL || 'gemini-3.5-flash-lite',
generationConfig: {
maxOutputTokens: r.action === 'quiz' ? 4096 : 3072,
...(r.action === 'quiz' ? { responseMimeType: 'application/json', responseSchema: quizSchema } : {})
}
}
});
models.set(key, model);
}
return model;
}
// Call directly from a button click, BEFORE any await that loses user activation.
export async function prepareLocal(language: 'vi' | 'en', progress: (value: number) => void) {
const model = modelFor({ action: 'quick', policy: 'local', language });
await model.initializeDeviceModel(progress);
}
export function parseQuiz(raw: string): QuizItem[] {
const data: unknown = JSON.parse(raw);
const list = (data as { questions?: unknown })?.questions;
if (!Array.isArray(list) || list.length !== 3) throw new Error('Quiz phải có đúng 3 câu.');
for (const q of list) {
if (!q || typeof q.questionMarkdown !== 'string' || typeof q.explanationMarkdown !== 'string'
|| !Array.isArray(q.options) || q.options.length !== 4
|| !q.options.every((x: unknown) => typeof x === 'string')
|| !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3)
throw new Error('Quiz không đúng cấu trúc. Hãy thử lại.');
}
return list as QuizItem[];
}
export async function study(r: StudyRequest, progress: (value: number) => void): Promise<StudyResult> {
validateRequest(r);
const model = modelFor(r);
const started = performance.now();
if (r.action === 'quick' || r.action === 'hint') {
// Start initialization while still in the originating user interaction.
const init = model.initializeDeviceModel(progress);
if (r.policy === 'local') await init;
else void init.catch(() => { /* hybrid may use the cloud; source is read from response */ });
}
const result = await model.generateContent(buildPrompt(r));
if (result.response.candidates?.some(c => c.finishReason === 'MAX_TOKENS'))
throw new Error('Câu trả lời bị cắt do giới hạn đầu ra. Hãy hỏi một phần nhỏ hơn.');
const raw = result.response.text().trim();
if (!raw) throw new Error('Không có câu trả lời. Hãy sửa câu hỏi hoặc kiểm tra bộ lọc nội dung.');
const quiz = r.action === 'quiz' ? parseQuiz(raw) : undefined;
return {
markdown: quiz ? quizToMarkdown(quiz) : raw, quiz,
source: result.response.inferenceSource ?? 'UNKNOWN',
durationMs: performance.now() - started
};
}
export function friendlyError(error: unknown): string {
const message = error instanceof Error ? error.message : String(error);
if (/429|quota|resource.exhausted/i.test(message)) return 'Hết quota hoặc hệ thống đang bận (429). Giữ nguyên câu hỏi; chờ rồi thử lại hoặc chọn local. Không tự lặp yêu cầu.';
if (/403|app.check|attestation|token/i.test(message)) return 'Kiểm tra App Check, debug token, domain và quyền/API của đúng project. / Check App Check and project setup.';
if (/404|model.not.found/i.test(message)) return 'Model cloud không khả dụng. Kiểm tra VITE_CLOUD_MODEL và quyền truy cập của project.';
return message;
}
