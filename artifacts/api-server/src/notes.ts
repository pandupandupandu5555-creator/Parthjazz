import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface Note {
  text: string;
  savedAt: string;
}

const DATA_DIR = join(process.cwd(), "data");
const NOTES_FILE = join(DATA_DIR, "notes.json");

function ensureFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(NOTES_FILE)) writeFileSync(NOTES_FILE, "[]", "utf-8");
}

export function readNotes(): Note[] {
  ensureFile();
  try {
    return JSON.parse(readFileSync(NOTES_FILE, "utf-8")) as Note[];
  } catch {
    return [];
  }
}

export function saveNote(text: string): void {
  const notes = readNotes();
  notes.push({ text, savedAt: new Date().toISOString() });
  writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), "utf-8");
}
