"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { watchAuthHistory } from "../auth-history";

export function AuthHistoryGuard({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (content.current) return watchAuthHistory(content.current, window);
  }, []);
  return <div ref={content}>{children}</div>;
}
