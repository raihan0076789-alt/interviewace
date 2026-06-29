"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamic import — Monaco uses browser APIs and must never run on the server
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div style={{
      height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0d1117",
      flexDirection: "column", gap: "0.75rem",
    }}>
      <Loader2 style={{ width: 20, height: 20, color: "#10B981", animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: "0.8rem", color: "rgba(110,231,183,0.4)" }}>Loading editor…</span>
    </div>
  ),
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: "python" | "javascript" | "java" | "cpp";
  height?: string;
  readOnly?: boolean;
}

const MONACO_LANG: Record<string, string> = {
  python: "python",
  javascript: "javascript",
  java: "java",
  cpp: "cpp",
};

export default function CodeEditor({
  value, onChange, language,
  height = "100%", readOnly = false,
}: CodeEditorProps) {
  return (
    <MonacoEditor
      height={height}
      language={MONACO_LANG[language] ?? "python"}
      value={value}
      theme="vs-dark"
      onChange={(val) => { if (!readOnly) onChange(val ?? ""); }}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        renderLineHighlight: "line",
        wordWrap: "on",
        tabSize: 4,
        insertSpaces: true,
        folding: true,
        bracketPairColorization: { enabled: true },
        autoIndent: "full",
        formatOnPaste: true,
        readOnly,
        padding: { top: 16, bottom: 16 },
        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
      }}
    />
  );
}