"use client";

import React, { useState, useRef } from "react";
import { Upload, X, CheckCircle2, Loader2, FileBox, FolderOpen } from "lucide-react";

type UploadState = "idle" | "uploading" | "processing" | "ready";

interface UploadModelModalProps {
  onClose: () => void;
  onUseModel: () => void;
}

export function UploadModelModal({ onClose, onUseModel }: UploadModelModalProps) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const simulateUpload = (name: string) => {
    setFileName(name);
    setState("uploading");
    setProgress(0);
    const up = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(up);
          setState("processing");
          setTimeout(() => setState("ready"), 2200);
          return 100;
        }
        return p + 12;
      });
    }, 200);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) simulateUpload(f.name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) simulateUpload(f.name);
  };

  const steps: { label: string; done: boolean; active: boolean }[] = [
    { label: "Uploading model", done: state === "processing" || state === "ready", active: state === "uploading" },
    { label: "Processing geometry", done: state === "ready", active: state === "processing" },
    { label: "Connecting programme data", done: state === "ready", active: false },
    { label: "Ready", done: state === "ready", active: state === "ready" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900">Upload Project Model</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Import your building model to connect programme data</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Drop zone */}
          {state === "idle" && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40"
                }`}
                onClick={() => inputRef.current?.click()}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 mb-3">
                  <Upload className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-[13px] font-semibold text-slate-700 mb-1">Drop your model here</p>
                <p className="text-[11px] text-slate-400 mb-3">or click to browse files</p>
                <div className="flex items-center gap-2">
                  {["IFC", "OBJ", "GLB", "GLTF"].map((fmt) => (
                    <span key={fmt} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">{fmt}</span>
                  ))}
                </div>
                <input ref={inputRef} type="file" className="hidden" accept=".ifc,.obj,.glb,.gltf" onChange={handleFileChange} />
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[10.5px] text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <button
                onClick={onUseModel}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileBox className="h-4 w-4 text-slate-500" />
                Use Sample Model — Ormiston Rise
              </button>
            </>
          )}

          {/* Progress state */}
          {state !== "idle" && (
            <div className="space-y-3">
              {/* File name */}
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <FileBox className="h-5 w-5 text-blue-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-slate-800 truncate">{fileName}</p>
                  {state === "uploading" && (
                    <div className="mt-1.5">
                      <div className="h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-200"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{progress}% uploaded</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : step.active ? (
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-200 shrink-0" />
                    )}
                    <span className={`text-[12px] ${step.done ? "text-emerald-700 font-medium" : step.active ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">Supported: IFC 2x3/4, OBJ, GLB, GLTF</p>
          {state === "ready" ? (
            <button
              onClick={onUseModel}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Open Model
            </button>
          ) : (
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
