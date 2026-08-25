/**
 * Pure client-side form validation. Mirrors FR-009 (this feature) and
 * 001-notes-crud-service FR-002/FR-010 — see
 * specs/002-notes-web-ui/data-model.md "Validation rules".
 *
 * @param {{title?: string, content?: string}} fields
 * @param {{requireBoth: boolean}} options requireBoth: true for create (both
 *   fields required); false for edit (at least one of the two required).
 * @returns {string[]} field-level error messages; empty array means valid.
 */
export function validateNoteForm({ title, content }, { requireBoth }) {
  const errors = [];
  const titleProvided = title !== undefined && title !== null;
  const contentProvided = content !== undefined && content !== null;
  const titleNonEmpty = titleProvided && title.trim().length > 0;
  const contentNonEmpty = contentProvided && content.trim().length > 0;

  if (requireBoth) {
    if (!titleNonEmpty) {
      errors.push("Title is required.");
    }
    if (!contentNonEmpty) {
      errors.push("Content is required.");
    }
    return errors;
  }

  // Edit mode: at least one of title/content must be supplied and non-empty;
  // a field that IS supplied must not be empty/whitespace-only.
  if (!titleProvided && !contentProvided) {
    errors.push("At least one of title or content must be supplied.");
    return errors;
  }
  if (titleProvided && !titleNonEmpty) {
    errors.push("Title must not be empty.");
  }
  if (contentProvided && !contentNonEmpty) {
    errors.push("Content must not be empty.");
  }
  return errors;
}
