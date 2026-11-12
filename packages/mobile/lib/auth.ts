import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const TOKEN_KEY = "bearer_token";

export async function getToken(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(TOKEN_KEY)) ?? "";
  } catch {
    return "";
  }
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
