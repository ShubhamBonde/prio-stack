import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

export default function MarkdownPreview({ text }) {
  const html = DOMPurify.sanitize(marked.parse(text || ""));
  return <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}
