import React from "react";
import { AutumnProvider } from "autumn-js/react";
import { getToken } from "../lib/auth";

// Patch global fetch to inject Bearer token for /api/autumn/* requests
const originalFetch = window.fetch;
window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/api/autumn/")) {
    const token = getToken();
    if (token) {
      init = {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
        },
      };
    }
  }
  return originalFetch(input, init);
};

interface ProviderProps {
  children: React.ReactNode;
}

export function Provider({ children }: ProviderProps) {
  return (
    <AutumnProvider>
      {children}
    </AutumnProvider>
  );
}
