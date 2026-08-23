/**
 * Minimal structured logger for the service layer (constitution Principle III).
 *
 * Used ONLY by the service layer. One call per successful mutating action
 * (create, update, delete) — read-only actions (list, get) are never logged.
 */

export type NoteAction = "create" | "update" | "delete";

export interface NoteLogEntry {
  action: NoteAction;
  noteId: string;
  timestamp: string;
}

/**
 * Emits one structured log line for a successful mutating note action.
 */
export function logNoteAction(action: NoteAction, noteId: string, timestamp: string): void {
  const entry: NoteLogEntry = { action, noteId, timestamp };
  console.log(JSON.stringify(entry));
}
