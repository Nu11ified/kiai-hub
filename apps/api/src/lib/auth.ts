import { createAuth } from "@kiai-hub/auth";
import { getDb } from "./db.js";
import { getEnv } from "./env.js";

let _auth: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!_auth) {
    _auth = createAuth({
      database: getDb(),
      secret: getEnv("BETTER_AUTH_SECRET"),
      baseURL: getEnv("BETTER_AUTH_URL"),
    });
  }
  return _auth;
}
