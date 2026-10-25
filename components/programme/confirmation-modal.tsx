"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertOctagon, X } from "lucide-react";
import { useProgramme } from "@/lib/programme-context";

export function ConfirmationModal() {
  const { confirmationDialog, closeConfirmationDialog } = useProgramme();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!confirmationDialog?.isOpen) return;
      if (e.key === "Escape") {
        confirmationDialog.onCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        confirmationDialog.onConfirm();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmationDialog]);

  if (!confirmationDialog || !confirmationDialog.isOpen) {
    return null;
  }

  const {
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    isDestructive = true,
    onConfirm,
    onCancel,
  } = confirmationDialog;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden transition-all text-stone-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-full flex-shrink-0 ${
                isDestructive
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {isDestructive ? (
                <AlertOctagon className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                id="confirm-modal-title"
                className="text-base font-semibold text-stone-100"
              >
                {title}
              </h3>
              <p className="mt-2 text-sm text-stone-400 leading-relaxed">
                {message}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-stone-400 hover:text-stone-200 p-1 rounded-md transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-950/60 border-t border-stone-800/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800/60 rounded-lg border border-stone-700/60 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-stone-900 ${
              isDestructive
                ? "bg-red-600 hover:bg-red-500 text-white focus:ring-red-500"
                : "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
