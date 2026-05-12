import React from "react";
import Editor from "@monaco-editor/react";

export default function StrategyEditor({ code, onChange }) {
  return (
    <div style={{ flex: 1, minHeight: 250, display: "flex", flexDirection: "column",
      borderBottom: "1px solid #2a2a35" }}>
      <h3 style={{ margin: 0, padding: "8px 12px", fontSize: 14,
        background: "#16161e", borderBottom: "1px solid #2a2a35" }}>
        Strategy Editor
      </h3>
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        value={code}
        onChange={(v) => onChange(v || "")}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          lineNumbers: "on",
          tabSize: 2,
        }}
      />
    </div>
  );
}