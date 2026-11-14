export type Subject = 'calculus' | 'discrete' | 'algorithms';
export type Action = 'quick' | 'hint' | 'deep' | 'quiz';
export type Policy = 'local' | 'hybrid';
export type Language = 'vi' | 'en';
export interface StudyRequest {
subject: Subject; action: Action; policy: Policy; language: Language;
excerpt: string; context: string; question: string;
answerMode?: 'grounded' | 'expanded';
documentTitle?: string;
sourcePage?: number;
}
export interface QuizItem {
questionMarkdown: string;
options: string[];
correctIndex: number;
explanationMarkdown: string;
}
export interface StudyResult {
markdown: string; quiz?: QuizItem[];
source: string; durationMs: number;
}
export interface SavedNote {
id: string; title: string; subject: Subject; excerpt: string;
markdown: string; createdAt: string;
documentTitle?: string; sourcePage?: number;
}
