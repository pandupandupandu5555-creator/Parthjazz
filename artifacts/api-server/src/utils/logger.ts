import fs from "fs";

export function logError(message: string) {
  fs.appendFileSync(
    "logs/errors.log",
    `[${new Date().toISOString()}] ${message}\n`
  );
}

export function logAI(message: string) {
  fs.appendFileSync(
    "logs/ai.log",
    `[${new Date().toISOString()}] ${message}\n`
  );
}

export function logRequest(message: string) {
  fs.appendFileSync(
    "logs/requests.log",
    `[${new Date().toISOString()}] ${message}\n`
  );
}
