/*

Author : Rajveer Sharma
Date : 16 Nov 2026
@ Nxtwave

*/

// Unsaved Log Interaction form contents, kept in this browser's localStorage so a reload, a dropped
// connection or an accidentally closed tab doesn't lose what the instructor typed. One draft per
// signed-in user and per student. Cleared once the server confirms the save.
// (Ported from the Interactions app's lib/interactionDraft.ts; fields are now generic.)

interface StoredDraft<T> {
  savedAt: string; // ISO time of the last change
  fields: T;
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // older drafts are dropped

export function interactionDraftKey(userId: string, target: { studentId: string; editingId?: string | null }): string {
  return `hub:interaction-draft:${userId}:${target.editingId ? `edit:${target.editingId}` : `new:${target.studentId}`}`;
}

// Storage can be unavailable (private mode, blocked site data); drafts are then simply not kept.
export function loadInteractionDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as StoredDraft<T>;
    if (!draft?.fields || Date.now() - new Date(draft.savedAt).getTime() > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveInteractionDraft<T>(key: string, fields: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ savedAt: new Date().toISOString(), fields } satisfies StoredDraft<T>));
  } catch {
    /* storage full or unavailable */
  }
}

export function clearInteractionDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* unavailable */
  }
}
