"use client";

import React, { useState, useRef } from "react";
import {
  Upload, X, CheckCircle2, Loader2, FileBox, FolderOpen,
  Building2, Layers, Check, ArrowRight,
} from "lucide-react";
import { PROJECT_PRESETS, type ProjectModelPreset } from "./model-data";

type UploadStep = "idle" | "uploading" | "processing" | "connecting" | "ready";

interface UploadModelModalProps {
  onClose: () => void;
  onUseModel: (project?: ProjectModelPreset) => void;
}

export function UploadModelModal({ onClose, onUseModel }: UploadModelModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "presets">("upload");
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<ProjectModelPreset>(PROJECT_PRESETS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startUploadSimulation = (name: string, project?: ProjectModelPreset) => {
    setFileName(name);
    setStep("uploading");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setStep("processing");
          setTimeout(() => {
            setStep("connecting");
            setTimeout(() => {
              setStep("ready");
            }, 1200);
          }, 1200);
          return 100;
        }
        return p + 16;
      });
    }, 150);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      startUploadSimulation(file.name);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      startUploadSimulation(file.name);
    }
  };

  const stepsList = [
    { id: "uploading",  label: "Uploading model",           active: step === "uploading",  done: step !== "idle" && step !== "uploading" },
    { id: "processing", label: "Processing geometry",       active: step === "processing", done: step === "connecting" || step === "ready" },
    { id: "connecting", label: "Connecting programme data", active: step === "connecting", done: step === "ready" },
    { id: "ready",      label: "Model ready",               active: step === "ready",      done: step === "ready" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden select-none">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Upload Project Model</h2>
              <p className="text-[11px] text-slate-400">
                Connect your construction programme spatially to building geometry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher: Upload File vs Select Pre-configured Building */}
        {step === "idle" && (
          <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
            <button
              onClick={() => setActiveTab("upload")}
              className={`py-2.5 text-[12px] font-semibold border-b-2 mr-5 transition-colors ${
                activeTab === "upload"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Upload Model File
            </button>
            <button
              onClick={() => setActiveTab("presets")}
              className={`py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${
                activeTab === "presets"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Building Types & Presets
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="px-6 py-5">
          {step === "idle" && activeTab === "upload" && (
            <div className="space-y-4">
              {/* Drop area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/60"
                    : "border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100/70 text-blue-600 mb-3 shadow-2xs">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-[13.5px] font-bold text-slate-800 mb-1">
                  Drag and drop model file here
                </p>
                <p className="text-[11.5px] text-slate-400 mb-3.5">
                  or browse your computer for local BIM / 3D files
                </p>

                {/* Formats */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {["IFC", "OBJ", "GLB / GLTF"].map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 shadow-2xs"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".ifc,.obj,.glb,.gltf"
                  onChange={handleFileChange}
                />
              </div>

              {/* Sample model shortcut */}
              <div className="pt-2">
                <button
                  onClick={() => startUploadSimulation("Ormiston_Rise_BIM_v3.glb", PROJECT_PRESETS[0])}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <FileBox className="h-4 w-4 text-blue-600" />
                    <span>Load sample model — <strong>Ormiston Rise (Building 2)</strong></span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {step === "idle" && activeTab === "presets" && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Select Architectural Archetype
              </p>
              {PROJECT_PRESETS.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    className={`flex items-start justify-between rounded-xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg mt-0.5 ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[13px] font-bold text-slate-900">{preset.name}</h4>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-semibold text-slate-600">
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{preset.building}</p>
                        <p className="text-[10.5px] text-slate-400 mt-1">{preset.description}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shrink-0 mt-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="pt-2">
                <button
                  onClick={() => startUploadSimulation(`${selectedPreset.name}.ifc`, selectedPreset)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <span>Load {selectedPreset.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Upload progress & connection state (Requirements 25 & 26) */}
          {step !== "idle" && (
            <div className="space-y-5 py-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shrink-0">
                  <FileBox className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 text-[13px] truncate">{fileName}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {step === "uploading" ? `Uploading geometry: ${progress}%` : "Processing model geometry & metadata"}
                  </p>

                  {step === "uploading" && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-150"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 4 Steps Checklist */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                {stepsList.map((st) => (
                  <div key={st.id} className="flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2.5">
                      {st.done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : st.active ? (
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-slate-200 shrink-0" />
                      )}
                      <span
                        className={`font-medium ${
                          st.done
                            ? "text-emerald-700 font-semibold"
                            : st.active
                            ? "text-blue-600 font-bold"
                            : "text-slate-400"
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>

                    {st.done && (
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        Complete
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Ready Button */}
              {step === "ready" && (
                <button
                  onClick={() => onUseModel(selectedPreset)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-[13px] font-bold text-white hover:bg-blue-700 transition-colors shadow-md"
                >
                  <span>Open 3D Programme</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
