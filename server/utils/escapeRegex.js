// Escapes regex special characters in user-supplied search strings before
// they're used inside `new RegExp(...)`. Without this, a search query like
// "(a+)+$" could trigger catastrophic backtracking (ReDoS), and characters
// like ".", "*", "|" would behave as regex operators instead of literal text.
export default function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
