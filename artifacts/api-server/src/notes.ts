import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export interface Note {
  category: string;
  text: string;
  importance: number;
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

export function saveNote(category: string, text: string): void {
  ensureFile();

  const notes = readNotes();

  notes.push({
    category,
    text,
    importance:
    category === "important_memories" ? 5 :
    category === "projects" ? 4 :
    category === "goals" ? 4 :
    category === "preferences" ? 3:
    2,
    savedAt: new Date().toISOString(),
  });

  writeFileSync(notesFile(), JSON.stringify(notes, null, 2), "utf-8");
}
export function deleteNote(text: string): boolean {
  ensureFile();

  const notes = readNotes();
  const filtered = notes.filter(note => note.text !== text);

  if (filtered.length === notes.length) {
    return false;
  }

  writeFileSync(
    notesFile(),
    JSON.stringify(filtered, null, 2),
    "utf-8"
  );

  return true;
}

export function clearNotes(): void {
  ensureFile();

  writeFileSync(
    notesFile(),
    JSON.stringify([], null, 2),
    "utf-8"
  );
}
