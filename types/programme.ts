export type TaskStatus = 'complete' | 'in_progress' | 'late' | 'not_started';

export type TaskLevel = 'project' | 'phase' | 'group' | 'subgroup' | 'task' | 'milestone';

export interface TaskOwner {
  id: string;
  type: 'vendor' | 'user';
  name: string;
  phone?: string;
  email?: string;
  trades?: string;
  avatarColor: string;
  initials: string;
}

export interface PendingVendorUpdate {
  vendorId: string;
  vendorName: string;
  vendorInitials: string;
  vendorColor: string;
  reportedPct: number;
  previousPct: number;
  comment: string;
  photoCount: number;
  submittedAt: string;
}

export interface ProgrammeTask {
  id: string;
  wbs: string;
  name: string;
  level: TaskLevel;
  parentId: string | null;
  status: TaskStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  displayStart: string;
  displayEnd: string;
  duration: number; // working days
  float: number; // working days
  progress: number; // 0 - 100
  plannedProgress: number; // 0 - 100
  costCode: string | null;
  costCodeName?: string;
  owner: TaskOwner | null;
  isCritical: boolean;
  isMilestone: boolean;
  predecessors: string[];
  successors: string[];
  notes?: string;
  depth: number;
  taskCount?: number;
  lateChildrenCount?: number;
  children?: string[];
  photoCount?: number;
  pendingUpdate?: PendingVendorUpdate;
  hasOverlap?: boolean;
  movedOffsetDays?: number;
}

export interface KPIFilterType {
  type: 'all' | 'variance' | 'milestone' | 'needs_attention' | 'work_items' | 'vendor_updates';
  subType?: 'overdue' | 'critical_overdue' | 'no_cost_code' | 'no_owner' | 'done' | 'active' | 'todo';
  label: string;
}

export interface TabFilter {
  id: 'all' | 'this_week' | '4_weeks' | 'late' | 'milestones' | 'in_progress' | 'critical_path';
  label: string;
  count: number;
}

export type TimelineZoomLevel = 'fit' | 'day' | 'week' | 'month' | 'year';

export type MainViewMode = 'list' | 'critical_path';

export interface SitePhotoItem {
  id: string;
  title: string;
  source: string;
  author: string;
  date: string;
  url: string;
  selected?: boolean;
}

export interface CostCodeItem {
  code: string;
  name: string;
  group: 'Preliminaries' | 'Trades' | 'Consultants';
  status: 'Prepare tender' | 'Tendering' | 'Contracted';
  budget: string;
}

export interface OwnerEntityItem {
  id: string;
  type: 'vendor' | 'user';
  name: string;
  initials: string;
  color: string;
  phone: string;
  email: string;
  trades: string;
  tasksCount: number;
  inProgressCount: number;
  overdueCount: number;
  averageProgress: number;
}
