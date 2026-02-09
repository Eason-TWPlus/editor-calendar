export interface Task {
  id: string;
  show: string;
  episode: string;
  editor: string;
  startDate: string;
  endDate: string;
  lastEditedAt: string;
  version: number;
  note?: string; // 🔥 新增：備註欄位
}

// 新增：節目詳細設定
export interface Program {
  id: string;
  name: string;
  workDays: number; // 預計工作天數
  duration: string; // 節目長度 (例如 10min)
  premiereDay: string; // 首播日 (例如 週五)
}

// 新增：剪輯師設定
export interface Editor {
  id: string;
  name: string;
  color: string; // 對應 Tailwind class
}

// 預設顏色庫 (給新增剪輯師時選用)
export const COLOR_OPTIONS = [
  { label: "Sky", value: "bg-sky-100 text-sky-700 hover:bg-sky-200" },
  { label: "Rose", value: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
  { label: "Amber", value: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { label: "Emerald", value: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" },
  { label: "Violet", value: "bg-violet-100 text-violet-700 hover:bg-violet-200" },
  { label: "Slate", value: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
  { label: "Orange", value: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
  { label: "Fuchsia", value: "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200" },
];