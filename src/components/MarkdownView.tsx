import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
export function MarkdownView({ value }: { value: string }) {
return <div className="markdown"><ReactMarkdown
skipHtml
remarkPlugins={[remarkGfm, remarkMath]}
rehypePlugins={[[rehypeKatex, { trust: false, strict: 'warn', throwOnError: false }]]}
components={{ img: () => null }}
>{value}</ReactMarkdown></div>;
}
