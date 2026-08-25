/**
 * Pure presentation helpers. See specs/002-notes-web-ui/data-model.md
 * "Browser-only derived values" — these are never sent back to the API.
 */

/**
 * Truncates content to `maxLength` characters, appending an ellipsis only
 * when it was actually cut off.
 */
export function truncateContent(content, maxLength = 100) {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.slice(0, maxLength)}…`;
}

/** Renders an ISO 8601 timestamp as a human-readable date/time string. */
export function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString();
}
