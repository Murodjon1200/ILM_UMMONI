import sanitizeHtml from "sanitize-html";

const controlCharacters =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeText(value: string, maxLength: number) {
  return sanitizeHtml(value.replace(controlCharacters, ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .trim()
    .slice(0, maxLength);
}
