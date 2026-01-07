"use client";

import { Button } from "@/components/ui/button";
import * as Icons from "@/components/icons";

interface HeaderProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function Header({ title, description, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {action && (
        <Button onClick={action.onClick}>
          <Icons.Plus size={16} className="mr-2" />
          {action.label}
        </Button>
      )}
    </header>
  );
}
