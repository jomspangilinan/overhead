"use client";

// Mounted once at the root layout — tools must register after hydration in
// the top-level document. It renders nothing; the agent strip in the shell
// reads the outcome from the store.

import { useEffect } from "react";
import { registerAllTools } from "./register";
import { useStore } from "@/store/useStore";

let registeredOnce = false;

export function WebMCPProvider() {
  const setOutcome = useStore((s) => s.setWebmcpOutcome);

  useEffect(() => {
    if (registeredOnce) return;
    registeredOnce = true;
    registerAllTools()
      .then(setOutcome)
      .catch((err) => {
        console.error("WebMCP registration failed:", err);
        setOutcome("error");
      });
  }, [setOutcome]);

  return null;
}
