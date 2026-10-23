"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  Loader2,
  FileBox,
  Building2,
  Check,
  ArrowRight,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";
import {
  type ProjectModelPreset,
  PROJECT_PRESETS,
} from "./model-data";
import {
  type ImportedModelData,
  validateModelFile,
  loadModelFromFile,
  loadSampleStructuralModel,
} from "@/lib/programme-model-loader";

interface UploadModelModalProps {
  onClose: () => void;
  onUseModel: (project?: ProjectModelPreset, importedModel?: ImportedModelData | null) => void;
  currentPreset?: ProjectModelPreset;
  activeImportedModel?: ImportedModelData | null;
}

export function UploadModelModal({
  onClose,
  onUseModel,
  currentPreset = PROJECT_PRESETS[0],
  activeImportedModel = null,
}: UploadModelModalProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "presets">("upload");
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [parsedModel, setParsedModel] = useState<ImportedModelData | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<ProjectModelPreset>(currentPreset);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // 1. Pre-validation
    const validation = validateModelFile(file.name, file.size);
    if (!validation.valid) {
      setStatus("error");
      setErrorMessage(validation.error || "Unsupported file format.");
      setRecommendation(validation.recommendation || null);
      setParsedModel(null);
      return;
    }

    // 2. Real parsing state
    setStatus("parsing");
    setErrorMessage(null);
    setRecommendation(null);

    try {
      const modelData = await loadModelFromFile(file);
      setParsedModel(modelData);
      setStatus("ready");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message || "Failed to parse 3D model geometry.");
      setRecommendation(
        "Please check that the file is an intact GLB, GLTF, or OBJ file and not corrupted."
      );
      setParsedModel(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleLoadSample = async () => {
    setStatus("parsing");
    setErrorMessage(null);
    setRecommendation(null);
    try {
      const sample = await loadSampleStructuralModel();
      setParsedModel(sample);
      setStatus("ready");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message || "Failed to load sample structural model.");
      setRecommendation("Please check network connectivity or try uploading a local model file.");
      setParsedModel(null);
    }
  };

  const handleApplyImportedModel = () => {
    if (parsedModel) {
      onUseModel(selectedPreset, parsedModel);
    }
  };

  const handleResetToProject = () => {
    onUseModel(selectedPreset, null);
  };

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
              <h2 className="text-[15px] font-bold text-slate-900">Project Model & 3D Import</h2>
              <p className="text-[11px] text-slate-400">
                Display construction geometry in the 3D Programme view
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

        {/* Tab Switcher: Import File vs Select Pre-configured Archetype */}
        {status === "idle" && (
          <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
            <button
              onClick={() => setActiveTab("upload")}
              className={`py-2.5 text-[12px] font-semibold border-b-2 mr-5 transition-colors ${
                activeTab === "upload"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Import 3D Model File
            </button>
            <button
              onClick={() => setActiveTab("presets")}
              className={`py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${
                activeTab === "presets"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Building Archetypes & Presets
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="px-6 py-5">
          {/* Active Model Indicator if already loaded */}
          {activeImportedModel && status === "idle" && (
            <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-3">
              <div className="flex items-center gap-2.5">
                <FileBox className="h-4 w-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-[11.5px] font-bold text-slate-900">
                    Active Custom Model: {activeImportedModel.fileName}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {activeImportedModel.meshCount} meshes · {activeImportedModel.vertexCount.toLocaleString()} vertices
                  </p>
                </div>
              </div>
              <button
                onClick={handleResetToProject}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 underline underline-offset-2"
              >
                Reset to Default
              </button>
            </div>
          )}

          {/* Tab 1: Upload File */}
          {status === "idle" && activeTab === "upload" && (
            <div className="space-y-4">
              {/* Drop Area */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? "border-blue-500 bg-blue-50/60"
                    : "border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100/70 text-blue-600 mb-2.5 shadow-2xs">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-[13.5px] font-bold text-slate-800 mb-1">
                  Drag and drop 3D model here
                </p>
                <p className="text-[11.5px] text-slate-400 mb-3">
                  Select a 3D construction model to display in the Programme view
                </p>

                {/* Formats Badges */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center mb-2">
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 shadow-2xs">
                    GLB / GLTF (Supported)
                  </span>
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 shadow-2xs">
                    OBJ (Supported)
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Note: IFC, RVT, and NWD formats require export to GLB or OBJ
                </p>

                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".glb,.gltf,.obj,.ifc,.rvt,.nwd"
                  onChange={handleFileChange}
                />
              </div>

              {/* Sample Structural Frame Action */}
              <div className="pt-1">
                <button
                  onClick={handleLoadSample}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span>Load sample real model — <strong>Structural Frame (.obj)</strong></span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Architectural Archetypes / Presets */}
          {status === "idle" && activeTab === "presets" && (
            <div className="space-y-2.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Select Architectural Archetype (With Mapped WBS Tasks)
              </p>
              {PROJECT_PRESETS.map((preset) => {
                const isSelected = selectedPreset.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset)}
                    className={`flex items-start justify-between rounded-xl border p-3 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/40 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg mt-0.5 ${
                          isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[12.5px] font-bold text-slate-900">{preset.name}</h4>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                            {preset.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{preset.building}</p>
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
                  onClick={() => onUseModel(selectedPreset, null)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <span>Use {selectedPreset.name} (Mapped Model)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Parsing State */}
          {status === "parsing" && (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <h3 className="text-[14px] font-bold text-slate-900">Parsing 3D Geometry</h3>
              <p className="text-[12px] text-slate-500 max-w-sm mx-auto">
                Validating mesh buffers, computing bounding box dimensions, and preparing Three.js geometry…
              </p>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/80 p-3.5">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[12px]">
                  <p className="font-bold text-red-900">{errorMessage}</p>
                  {recommendation && <p className="text-red-700 text-[11.5px]">{recommendation}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setStatus("idle");
                    setErrorMessage(null);
                    setRecommendation(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Another File
                </button>
                <button
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Ready / Success State */}
          {status === "ready" && parsedModel && (
            <div className="space-y-4 py-2">
              {/* File details card */}
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 truncate">
                    {parsedModel.fileName}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Format: <span className="font-semibold uppercase">{parsedModel.fileType}</span> · Size: {(parsedModel.fileSize / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              {/* Geometry Stats */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Meshes</p>
                  <p className="text-[14px] font-bold text-slate-800">{parsedModel.meshCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Vertices</p>
                  <p className="text-[14px] font-bold text-slate-800">{parsedModel.vertexCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Dimensions</p>
                  <p className="text-[11.5px] font-bold text-slate-800">
                    {parsedModel.boundingBox.size[0].toFixed(1)}m × {parsedModel.boundingBox.size[1].toFixed(1)}m
                  </p>
                </div>
              </div>

              {/* Data Integrity Notice */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11.5px] text-amber-900">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Data Integrity Note:</strong> Raw 3D mesh files do not carry PlanD-X WBS task associations. The model geometry will be displayed with full camera and orbit controls; project schedule dates remain connected to your programme.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    setStatus("idle");
                    setParsedModel(null);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleApplyImportedModel}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-[12.5px] font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <span>Display in 3D Programme</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
