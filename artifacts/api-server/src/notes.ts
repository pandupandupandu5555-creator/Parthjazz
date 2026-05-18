import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export interface Note {
  text: string;
  savedAt: string;
}

// Resolve relative to this file, not process.cwd() — works regardless of
// where the process was started from.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

function notesFile(): string {
  return join(ROOT, "notes.json");
}

function ensureFile(): void {
  if (!existsSync(ROOT)) mkdirSync(ROOT, { recursive: true });
  const file = notesFile();
  if (!existsSync(file)) writeFileSync(file, "[]", "utf-8");
}

export function readNotes(): Note[] {
  ensureFile();
  try {
    return JSON.parse(readFileSync(notesFile(), "utf-8")) as Note[];
  } catch {
    return [];
  }
}

export function saveNote(text: string): void {
  ensureFile();
  const notes = readNotes();
  notes.push({ text, savedAt: new Date().toISOString() });
  writeFileSync(notesFile(), JSON.stringify(notes, null, 2), "utf-8");
}
