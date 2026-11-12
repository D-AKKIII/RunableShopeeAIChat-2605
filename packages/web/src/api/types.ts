import type { auth } from "./auth";
import type { InferSessionFromClient, InferUserFromClient } from "better-auth";

type Auth = typeof auth;

export type AppUser = InferUserFromClient<Auth> | null;
export type AppSession = InferSessionFromClient<Auth> | null;

export type HonoVariables = {
  user: AppUser;
  session: AppSession;
};
