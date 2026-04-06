import { createDb } from "@kiai-hub/db";
import { getEnv } from "./env.js";

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb(getEnv("DATABASE_URL"));
  }
  return _db;
}
