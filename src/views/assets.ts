import { JS } from "./scripts.js";
import { CSS } from "./styles.js";

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export const CSS_HASH = fnv1a(CSS);
export const JS_HASH = fnv1a(JS);
export const CSS_PATH = `/assets/styles-${CSS_HASH}.css`;
export const JS_PATH = `/assets/scripts-${JS_HASH}.js`;
