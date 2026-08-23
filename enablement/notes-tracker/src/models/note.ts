/**
 * A single piece of personal information a user has captured.
 * See specs/001-notes-crud-service/data-model.md for the full contract.
 */
export interface Note {
  /** Unique identifier, assigned on create. Immutable after creation. */
  id: string;
  /** Non-empty title. */
  title: string;
  /** Non-empty content. */
  content: string;
  /** ISO 8601 timestamp, set on create and refreshed on every successful update. */
  updatedAt: string;
}
