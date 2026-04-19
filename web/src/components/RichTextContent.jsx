import DOMPurify from "dompurify";

export function richTextToPlainText(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isRichTextEmpty(html) {
  return richTextToPlainText(html).length === 0;
}

export default function RichTextContent({ value, emptyLabel = "No details yet", className = "" }) {
  if (isRichTextEmpty(value)) {
    return <p className={className}>{emptyLabel}</p>;
  }
  return <div className={className} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value || "") }} />;
}
