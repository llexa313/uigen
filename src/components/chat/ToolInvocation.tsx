"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation as ToolInvocationType } from "ai";

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

interface ToolInvocationProps {
  tool: ToolInvocationType;
}

export function ToolInvocation({ tool }: ToolInvocationProps) {
  const isDone = tool.state === "result" && tool.result;
  const fileName = tool.args?.path ? getFileName(tool.args.path as string) : null;

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isDone ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-neutral-700">
            {fileName ? (
              <>Updated <span className="font-mono">{fileName}</span></>
            ) : (
              "Files updated"
            )}
          </span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">
            {fileName ? (
              <>Editing <span className="font-mono">{fileName}</span>...</>
            ) : (
              "Editing files..."
            )}
          </span>
        </>
      )}
    </div>
  );
}
