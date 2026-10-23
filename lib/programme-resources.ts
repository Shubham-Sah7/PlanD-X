// PlanD-X Subcontractor & Resource Directory
// ===========================================
import { INITIAL_VENDORS_AND_TEAM } from "@/data/mock-programme";

export interface AssignableResource {
  id: string;
  type: "vendor" | "user";
  name: string;
  initials: string;
  color: string;
  trades?: string;
  phone?: string;
  email?: string;
  badgeLabel?: string;
}

// Master catalogue of available Subcontractors and Project Resources
// Built directly from existing application data in mock-programme and toolbar contracts
export const MASTER_SUBCONTRACTORS: AssignableResource[] = [
  {
    id: "vendor-furzer",
    type: "vendor",
    name: "Furzer Electrical",
    initials: "FE",
    color: "#b45309",
    trades: "Electrical & Data",
    phone: "0413 555 666",
    email: "frank@furzerelec.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-geotech",
    type: "vendor",
    name: "GeoTech Piling",
    initials: "GP",
    color: "#c2410c",
    trades: "Civil, Piling & Shoring",
    phone: "0413 111 222",
    email: "george@geotechpiling.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-kpa",
    type: "vendor",
    name: "KPA Structural",
    initials: "KS",
    color: "#ca8a04",
    trades: "Structural Steel & Concrete",
    phone: "0413 333 444",
    email: "karen@kpastructural.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-jk-mohr",
    type: "vendor",
    name: "JK MOHR PTY LTD",
    initials: "JM",
    color: "#d97706",
    trades: "Masonry & Blockwork",
    phone: "0413 888 777",
    email: "admin@jkmohr.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-ironbark",
    type: "vendor",
    name: "Ironbark",
    initials: "IB",
    color: "#9a3412",
    trades: "Landscaping & Civil Works",
    phone: "0413 999 000",
    email: "ops@ironbark.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-apex",
    type: "vendor",
    name: "Apex Groundworks",
    initials: "AG",
    color: "#059669",
    trades: "Groundworks & Bulk Excavation",
    phone: "0412 123 456",
    email: "contracts@apexgroundworks.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-main",
    type: "vendor",
    name: "Main Contractor",
    initials: "MC",
    color: "#2563eb",
    trades: "Principal Contractor",
    phone: "0412 888 999",
    email: "site@maincontractor.com.au",
    badgeLabel: "Main Contractor",
  },
];

export const MASTER_TEAM_MEMBERS: AssignableResource[] = [
  {
    id: "user-demo",
    type: "user",
    name: "Demo Builder",
    initials: "DB",
    color: "#3b82f6",
    trades: "Construction Management",
    phone: "0412 888 999",
    email: "builder@ormistonrise.com.au",
    badgeLabel: "Project Team",
  },
  {
    id: "user-rachit",
    type: "user",
    name: "Rachit Agarwal",
    initials: "RA",
    color: "#8b5cf6",
    trades: "Project Director",
    phone: "0412 777 666",
    email: "rachit@nurpam.com",
    badgeLabel: "Project Team",
  },
  {
    id: "user-sarah-j",
    type: "user",
    name: "Sarah Jenkins",
    initials: "SJ",
    color: "#ec4899",
    trades: "Contract Administration",
    phone: "0412 333 222",
    email: "sarah.j@ormistonrise.com.au",
    badgeLabel: "Project Team",
  },
  {
    id: "user-john-s",
    type: "user",
    name: "John Smith",
    initials: "JS",
    color: "#2563eb",
    trades: "Site Supervision",
    badgeLabel: "Site Team",
  },
  {
    id: "user-paul-t",
    type: "user",
    name: "Paul Turner",
    initials: "PT",
    color: "#7c3aed",
    trades: "Structural Engineering",
    badgeLabel: "Engineering",
  },
  {
    id: "user-sarah-c",
    type: "user",
    name: "Sarah Carter",
    initials: "SC",
    color: "#db2777",
    trades: "M&E Coordination",
    badgeLabel: "Engineering",
  },
  {
    id: "user-mike-j",
    type: "user",
    name: "Mike Johnson",
    initials: "MJ",
    color: "#4f46e5",
    trades: "Groundworks Supervision",
    badgeLabel: "Site Team",
  },
  {
    id: "user-ryan-w",
    type: "user",
    name: "Ryan Wilson",
    initials: "RW",
    color: "#e11d48",
    trades: "Foundations Specialist",
    badgeLabel: "Site Team",
  },
  {
    id: "user-emma-c",
    type: "user",
    name: "Emma Collins",
    initials: "EC",
    color: "#d97706",
    trades: "Project Engineering",
    badgeLabel: "Engineering",
  },
  {
    id: "user-david-w",
    type: "user",
    name: "David Wilson",
    initials: "DW",
    color: "#0d9488",
    trades: "Superstructure Lead",
    badgeLabel: "Site Team",
  },
  {
    id: "user-tom-h",
    type: "user",
    name: "Tom Harris",
    initials: "TH",
    color: "#059669",
    trades: "Enabling Works Lead",
    badgeLabel: "Site Team",
  },
];

export const ALL_ASSIGNABLE_RESOURCES: AssignableResource[] = [
  ...MASTER_SUBCONTRACTORS,
  ...MASTER_TEAM_MEMBERS,
];

export function getSubcontractors(): AssignableResource[] {
  return MASTER_SUBCONTRACTORS;
}

export function getTeamMembers(): AssignableResource[] {
  return MASTER_TEAM_MEMBERS;
}

export function getAllAssignableResources(): AssignableResource[] {
  return ALL_ASSIGNABLE_RESOURCES;
}

export function findResourceByName(
  name: string | null | undefined,
): AssignableResource | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return ALL_ASSIGNABLE_RESOURCES.find(
    (r) => r.name.toLowerCase() === clean || r.initials.toLowerCase() === clean,
  );
}

export function getResourceInitials(name: string): string {
  const resource = findResourceByName(name);
  if (resource) return resource.initials;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getResourceColor(nameOrInitials: string): string {
  const resource = findResourceByName(nameOrInitials);
  if (resource) return resource.color;
  // Deterministic fallback color
  const colors = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#c2410c",
    "#059669",
    "#d97706",
    "#4f46e5",
    "#0d9488",
  ];
  let hash = 0;
  for (let i = 0; i < nameOrInitials.length; i++) {
    hash = nameOrInitials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
