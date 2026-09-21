"use client";

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Could not copy — select and copy manually');
  }
}

/**
 * Read-only field with a copy button, for one-time-shown secrets (invite
 * links, pairing codes, generated passwords). Monospace so every character
 * (including easily-confused ones like 0/O or l/1) is visually distinct,
 * and copyable with one click instead of relying on manual text selection.
 */
export function CopyField({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <Input readOnly value={value} className="font-mono text-sm" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={async () => {
          await copyToClipboard(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
