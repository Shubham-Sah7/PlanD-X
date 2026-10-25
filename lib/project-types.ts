/**
 * PlanD-X Project Data Types & Models
 * ====================================
 * Comprehensive project-level attributes matching industrial construction standards.
 */

export interface ConstructionProject {
  id: string;
  code: string; // Project Number (e.g. "PRJ-2026-001")
  name: string; // Project Name
  description?: string;
  location: string; // Site location (e.g. "Siliguri, WB" or "London, UK")
  clientName?: string;
  plannedStartDate: string; // ISO YYYY-MM-DD
  plannedFinishDate?: string; // ISO YYYY-MM-DD
  scheduleFromStart: boolean; // true = Forward pass from start date, false = Backward from finish
  statusDate: string; // Project current status date (ISO YYYY-MM-DD)
  calendarId: string; // Default calendar ID
  currency: string; // "GBP", "USD", "AUD", "EUR", "INR"
  units: "metric" | "imperial";
  isDemo?: boolean; // Flag distinguishing sample/demo projects
  createdAt: string;
  updatedAt: string;
}

export type ProjectTemplateType =
  | "blank"
  | "commercial-fitout"
  | "multi-storey-residential"
  | "civil-infrastructure";

export interface CreateProjectInput {
  name: string;
  code: string;
  description?: string;
  location?: string;
  clientName?: string;
  plannedStartDate?: string;
  plannedFinishDate?: string;
  scheduleFromStart?: boolean;
  statusDate?: string;
  calendarId?: string;
  currency?: string;
  units?: "metric" | "imperial";
  template?: ProjectTemplateType;
}
