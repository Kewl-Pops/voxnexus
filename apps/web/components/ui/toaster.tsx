// Copyright 2026 Cothink LLC. Licensed under Apache-2.0.

"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
    />
  );
}
