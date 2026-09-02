"use client";

import { useEffect, useState } from "react";
import { registerAllTools, type RegisterOutcome } from "./register";
import { ToolPanel } from "./panel";

type Status = "checking" | RegisterOutcome | "error";

let registeredOnce = false;

/**
 * Mounted once at the root layout. Registers every tool after hydration,
 * in the top-level document, via the imperative API only.
 */
export function WebMCPProvider() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (registeredOnce) return;
    registeredOnce = true;
    registerAllTools()
      .then(setStatus)
      .catch((err) => {
        console.error("WebMCP registration failed:", err);
        setStatus("error");
      });
  }, []);

  return <ToolPanel outcome={status} />;
}
