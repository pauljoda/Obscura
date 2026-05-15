import { marked } from "marked";

const UNSAFE_BLOCK_RE = /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi;
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const UNSAFE_URL_RE = /\s+(href|src)\s*=\s*(["'])\s*(?:javascript|data):[^"']*\2/gi;
const UNSAFE_SCHEME_RE = /\b(?:javascript|data):/gi;

function sanitizeHtml(html: string): string {
  return html
    .replace(UNSAFE_BLOCK_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(UNSAFE_URL_RE, "")
    .replace(UNSAFE_SCHEME_RE, "");
}

/** Renders user-editable entity descriptions as a sanitized markdown fragment. */
export function renderEntityDescriptionMarkdown(description: string | null | undefined): string | null {
  if (!description) return null;

  const renderer = new marked.Renderer();
  renderer.link = ({ href, text }) => {
    const safeHref = href.trim();
    if (/^(javascript|data):/i.test(safeHref)) {
      return text;
    }

    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  };

  const html = marked.parse(description, { renderer, async: false, gfm: true, breaks: true }) as string;
  return sanitizeHtml(html);
}
