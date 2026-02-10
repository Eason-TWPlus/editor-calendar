import { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { COLOR_OPTIONS } from './types';
import type { Task, Program, Editor } from './types';
import { 
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, isSameDay, parseISO, isWithinInterval, addMonths, subMonths, isToday, isBefore, isAfter, startOfDay 
} from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { 
  BarChart3, Settings, Plus, ChevronLeft, ChevronRight, 
  Trash2, X, User, LayoutGrid, CheckCircle2, Clock, PlayCircle, Edit3, Film, Tv, Monitor, StickyNote, Calendar as CalendarIcon, RotateCcw
} from 'lucide-react';

// --- 安全設定 ---
const FALLBACK_EDITORS: Editor[] = [
  { id: "e1", name: "James", color: "bg-sky-100 text-sky-700 hover:bg-sky-200" },
  { id: "e2", name: "Dolphine", color: "bg-rose-100 text-rose-700 hover:bg-rose-200" },
  { id: "e3", name: "Eason", color: "bg-amber-100 text-amber-700 hover:bg-amber-200" },
  { id: "e4", name: "Other", color: "bg-slate-100 text-slate-600 hover:bg-slate-200" },
];

const getTheme = (colorString: string | undefined) => {
  const safe = colorString || "";
  if (safe.includes("sky")) return { pill: "bg-sky-100 text-sky-700", bar: "bg-sky-500", border: "border-sky-200" };
  if (safe.includes("rose")) return { pill: "bg-rose-100 text-rose-700", bar: "bg-rose-500", border: "border-rose-200" };
  if (safe.includes("amber")) return { pill: "bg-amber-100 text-amber-700", bar: "bg-amber-500", border: "border-amber-200" };
  if (safe.includes("emerald")) return { pill: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", border: "border-emerald-200" };
  if (safe.includes("violet")) return { pill: "bg-violet-100 text-violet-700", bar: "bg-violet-500", border: "border-violet-200" };
  if (safe.includes("orange")) return { pill: "bg-orange-100 text-orange-700", bar: "bg-orange-500", border: "border-orange-200" };
  if (safe.includes("fuchsia")) return { pill: "bg-fuchsia-100 text-fuchsia-700", bar: "bg-fuchsia-500", border: "border-fuchsia-200" };
  return { pill: "bg-slate-100 text-slate-600", bar: "bg-slate-500", border: "border-slate-200" };
};

const AnimatedBar = ({ width, colorClass }: { width: number, colorClass: string }) => {
  const [currentWidth, setCurrentWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setCurrentWidth(width), 100); 
    return () => clearTimeout(timer);
  }, [width]);
  return <div className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`} style={{ width: `${currentWidth}%` }}></div>;
};

const NumberTicker = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value || 0;
    if (start === end) return;
    const duration = 1000;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setDisplayValue(end); clearInterval(timer); } 
      else { setDisplayValue(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{displayValue}</span>;
};

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]); 
  
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [statsDate, setStatsDate] = useState(new Date()); 
  const [view, setView] = useState<'calendar' | 'stats' | 'manage'>('calendar');
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task>>({});
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Partial<Program>>({});
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingEditor, setEditingEditor] = useState<Partial<Editor>>({});

  useEffect(() => {
    const unsubTasks = onSnapshot(query(collection(db, "tasks"), orderBy("startDate", "asc")), (snap) => setTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task))));
    const unsubPrograms = onSnapshot(collection(db, "programs"), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Program));
      if (list.length === 0) seedDefaultPrograms(); else setPrograms(list);
    });
    const unsubEditors = onSnapshot(collection(db, "editors"), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Editor));
      if (list.length === 0) seedDefaultEditors(); else setEditors(list);
    });
    return () => { unsubTasks(); unsubPrograms(); unsubEditors(); };
  }, []);

  const seedDefaultPrograms = async () => {
    const defaults = [
      { id: 'p1', name: "Correspondents", workDays: 3, duration: "10min", premiereDay: "週五" },
      { id: 'p2', name: "DC Insiders", workDays: 2, duration: "5min", premiereDay: "週二" },
      { id: 'p3', name: "Finding Formosa", workDays: 5, duration: "15min", premiereDay: "週日" },
      { id: 'p4', name: "Zoom In, Zoom Out", workDays: 3, duration: "8min", premiereDay: "週三" },
    ];
    defaults.forEach(p => setDoc(doc(db, "programs", p.id), p));
  };
  const seedDefaultEditors = async () => { FALLBACK_EDITORS.forEach(e => setDoc(doc(db, "editors", e.id), e)); };

  const saveTask = async () => {
    if (!editingTask.show || !editingTask.editor || !editingTask.startDate || !editingTask.endDate) return alert("請填寫完整");
    const id = editingTask.id || doc(collection(db, "tasks")).id;
    await setDoc(doc(db, "tasks", id), { ...editingTask, id, lastEditedAt: new Date().toISOString() });
    setIsTaskModalOpen(false); setEditingTask({});
  };
  const deleteTask = async (id: string) => { if (confirm("刪除此任務？")) { await deleteDoc(doc(db, "tasks", id)); setIsTaskModalOpen(false); } };

  const saveProgram = async () => {
    if (!editingProgram.name) return alert("請填寫名稱");
    const id = editingProgram.id || doc(collection(db, "programs")).id;
    await setDoc(doc(db, "programs", id), { ...editingProgram, id });
    setIsProgramModalOpen(false); setEditingProgram({});
  };
  const deleteProgram = async (id: string) => { if (confirm("刪除此節目？")) await deleteDoc(doc(db, "programs", id)); setIsProgramModalOpen(false); };

  const saveEditor = async () => {
    if (!editingEditor.name) return alert("請填寫名稱");
    const id = editingEditor.id || doc(collection(db, "editors")).id;
    await setDoc(doc(db, "editors", id), { ...editingEditor, id, color: editingEditor.color || COLOR_OPTIONS[0].value });
    setIsEditorModalOpen(false); setEditingEditor({});
  };
  const deleteEditor = async (id: string) => { if (confirm("刪除此成員？")) await deleteDoc(doc(db, "editors", id)); setIsEditorModalOpen(false); };

  const getTaskStatus = (task: Partial<Task>) => {
    if (!task.startDate || !task.endDate) return 'unknown';
    const today = startOfDay(new Date());
    if (isBefore(parseISO(task.endDate), today)) return 'completed';
    if (isAfter(parseISO(task.startDate), today)) return 'upcoming';
    return 'active';
  };

  const getEditorData = (name: string) => {
    const fromDB = editors.find(e => e.name === name);
    if (fromDB) return fromDB;
    const fromFallback = FALLBACK_EDITORS.find(e => e.name === name);
    return fromFallback || { name, color: "bg-slate-100 text-slate-500", id: "unknown" };
  };

  const stats = useMemo(() => {
    const currentMonthStr = format(statsDate, 'yyyy-MM');
    const monthlyTasks = tasks.filter(t => t.startDate.startsWith(currentMonthStr) || t.endDate.startsWith(currentMonthStr));
    const totalPrograms = tasks.length;
    const totalWorkload: Record<string, number> = {};
    tasks.forEach(t => totalWorkload[t.editor] = (totalWorkload[t.editor] || 0) + 1);
    const monthlyCount = monthlyTasks.length;
    const monthlyWorkload: Record<string, number> = {};
    monthlyTasks.forEach(t => monthlyWorkload[t.editor] = (monthlyWorkload[t.editor] || 0) + 1);
    return { totalPrograms, totalWorkload, monthlyCount, monthlyWorkload };
  }, [tasks, statsDate]);

  const taskLayout = useMemo(() => {
    const sortedTasks = [...tasks].sort((a, b) => {
      const startDiff = a.startDate.localeCompare(b.startDate);
      if (startDiff !== 0) return startDiff;
      return b.endDate.localeCompare(a.endDate);
    });
    const layout: Record<string, number> = {};
    const lanes: string[] = [];
    sortedTasks.forEach(task => {
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) { if (lanes[i] < task.startDate) { assignedLane = i; lanes[i] = task.endDate; break; } }
      if (assignedLane === -1) { assignedLane = lanes.length; lanes.push(task.endDate); }
      layout[task.id] = assignedLane;
    });
    return layout;
  }, [tasks]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
  const displayEditors = editors.length > 0 ? editors : FALLBACK_EDITORS;

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-white text-slate-700 font-sans selection:bg-slate-200 overflow-hidden">
      
      {/* 🔥 1. 電腦版側邊欄 (MD 以上顯示，手機隱藏) */}
      <aside className="hidden md:flex w-20 bg-white border-r border-slate-100 flex-col items-center py-6 gap-4 z-50 shrink-0 shadow-lg">
        <div className="w-10 h-10 mb-4 flex items-center justify-center"><span className="font-black text-xl tracking-tighter text-slate-800">EF.</span></div>
        <nav className="flex flex-col gap-4 w-full px-2">
          <NavBtn icon={<LayoutGrid size={24} />} label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
          <NavBtn icon={<BarChart3 size={24} />} label="Insights" active={view === 'stats'} onClick={() => setView('stats')} />
          <div className="flex-1"></div>
          <NavBtn icon={<Settings size={24} />} label="Settings" active={view === 'manage'} onClick={() => setView('manage')} />
        </nav>
      </aside>

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Header (手機版微調) */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0 z-40 relative">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 truncate">
              {view === 'calendar' && "Production"}
              {view === 'stats' && "Insights"}
              {view === 'manage' && "Settings"}
            </h1>
          </div>
          
          {view === 'calendar' && (
            <div className="flex items-center gap-2 md:gap-3">
              <button onClick={() => setCurrentDate(new Date())} className="hidden md:flex px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-bold transition-colors items-center gap-1"><RotateCcw size={14}/> Today</button>
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100 shadow-sm">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-white rounded text-slate-500 transition-colors"><ChevronLeft size={16}/></button>
                <div className="relative group">
                   <CalendarIcon size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none hidden md:block" />
                   <input type="month" className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer pl-1 md:pl-7 pr-1 py-1 w-24 md:w-32" value={format(currentDate, 'yyyy-MM')} onChange={(e) => e.target.value && setCurrentDate(parseISO(e.target.value))} />
                </div>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-white rounded text-slate-500 transition-colors"><ChevronRight size={16}/></button>
              </div>
            </div>
          )}
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth z-0">
          
          {/* 🔥 2. 行事曆容器：手機版底部增加高度 (pb-24)，避免被下方導航欄擋住 */}
          {view === 'calendar' && (
            <div className="flex flex-col h-full bg-white">
              <div className="flex-1 overflow-auto">
                {/* 最小寬度 800px 確保不變形，底部留白增加 */}
                <div className="min-w-[800px] h-full flex flex-col pb-24 md:pb-8">
                  <div className="grid grid-cols-7 border-b border-slate-100 sticky top-0 bg-white z-10">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-3 text-center text-[11px] font-medium text-slate-400 uppercase tracking-widest">{d}</div>)}
                  </div>
                  <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-50/30">
                    {calendarDays.map((day) => {
                      const todaysTasks = tasks.filter(t => isWithinInterval(day, { start: parseISO(t.startDate), end: parseISO(t.endDate) }));
                      const maxRowIndex = todaysTasks.reduce((max, t) => Math.max(max, taskLayout[t.id] || 0), -1);
                      const isCurrentMonth = format(day, 'M') === format(currentDate, 'M');
                      return (
                        <div key={day.toISOString()} onClick={() => { setEditingTask({ startDate: format(day, 'yyyy-MM-dd'), endDate: format(day, 'yyyy-MM-dd') }); setIsTaskModalOpen(true); }} className={`border-b border-r border-slate-100 min-h-32 p-0 flex flex-col ${!isCurrentMonth ? 'bg-slate-50/80 text-slate-300' : 'bg-white hover:bg-slate-50'}`}>
                          <div className="p-1.5 flex justify-center pointer-events-none"><span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] font-semibold ${isToday(day) ? 'bg-slate-800 text-white' : isCurrentMonth ? 'text-slate-500' : ''}`}>{format(day, 'd')}</span></div>
                          <div className="flex flex-col w-full relative pb-1"> 
                            {Array.from({ length: Math.max(maxRowIndex + 1, 0) }).map((_, rowIndex) => {
                              const task = todaysTasks.find(t => taskLayout[t.id] === rowIndex);
                              if (!task) return <div key={`spacer-${rowIndex}`} className="h-7 w-full mb-0.5"></div>;
                              const editorData = getEditorData(task.editor);
                              const theme = getTheme(editorData.color);
                              const isStart = isSameDay(day, parseISO(task.startDate));
                              const isEnd = isSameDay(day, parseISO(task.endDate));
                              const status = getTaskStatus(task);
                              let shapeClass = isStart && isEnd ? 'rounded mx-1.5' : isStart ? 'rounded-l -mr-px ml-1.5' : isEnd ? 'rounded-r -ml-px mr-1.5' : 'rounded-none -mx-px';
                              const statusClass = status === 'completed' ? 'shadow-none opacity-100' : 'shadow-sm opacity-100';
                              return (
                                <div key={task.id} onClick={(e) => { e.stopPropagation(); setEditingTask(task); setIsTaskModalOpen(true); }} className={`relative h-7 text-[10px] px-2 flex items-center cursor-pointer truncate transition-all hover:brightness-95 z-10 mb-0.5 ${theme.pill} ${shapeClass} ${statusClass}`} title={`${task.show} #${task.episode} ${task.note ? `| 備註: ${task.note}` : ''}`}>
                                  {(isStart || format(day, 'E') === 'Mon') && (
                                    <div className="flex items-center gap-1 font-medium truncate w-full">
                                      {status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>}
                                      {status === 'completed' && <CheckCircle2 size={10} />}
                                      {task.note && <StickyNote size={10} className="opacity-70" />}
                                      <span className="truncate">{task.show} #{task.episode}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'stats' && (
            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Film className="text-slate-400"/> 歷史總覽 (Total)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex items-center justify-between">
                      <div><p className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-1">Total Programs</p><p className="text-5xl font-black tracking-tight text-white"><NumberTicker value={stats.totalPrograms} /></p></div>
                      <Monitor size={48} className="text-slate-700 opacity-50"/>
                   </div>
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-4">Total Workload by Editor</p>
                      <div className="flex gap-2 flex-wrap">
                        {displayEditors.map(e => (
                          <div key={e.id} className="flex flex-col items-center p-3 bg-slate-50 rounded-lg min-w-20 flex-1"><span className="text-2xl font-bold text-slate-700"><NumberTicker value={stats.totalWorkload[e.name] || 0} /></span><span className="text-[10px] text-slate-400 font-bold uppercase mt-1 text-center truncate w-full">{e.name}</span></div>
                        ))}
                      </div>
                   </div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Clock className="text-slate-400"/> 月度概況 (Monthly)</h2>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button onClick={() => setStatsDate(subMonths(statsDate, 1))} className="p-1.5 hover:bg-slate-50 rounded text-slate-500 transition-colors"><ChevronLeft size={16}/></button>
                    <div className="relative group">
                      <CalendarIcon size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none hidden md:block" />
                      <input type="month" className="bg-transparent text-sm font-bold text-slate-700 focus:outline-none cursor-pointer pl-1 md:pl-7 pr-1 py-1 w-24 md:w-32" value={format(statsDate, 'yyyy-MM')} onChange={(e) => e.target.value && setStatsDate(parseISO(e.target.value))} />
                    </div>
                    <button onClick={() => setStatsDate(addMonths(statsDate, 1))} className="p-1.5 hover:bg-slate-50 rounded text-slate-500 transition-colors"><ChevronRight size={16}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div><p className="text-slate-400 text-sm uppercase font-bold tracking-wider mb-1">Monthly Programs</p><p className="text-4xl font-black tracking-tight text-indigo-600"><NumberTicker value={stats.monthlyCount} /></p></div>
                      <div className="h-12 w-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">{format(statsDate, 'M')}月</div>
                   </div>
                   <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-4">Monthly Workload</p>
                      <div className="space-y-4">
                        {displayEditors.map(editor => {
                           const count = stats.monthlyWorkload[editor.name] || 0;
                           const max = Math.max(...Object.values(stats.monthlyWorkload), 1);
                           const theme = getTheme(editor.color);
                           return (
                             <div key={editor.id}>
                               <div className="flex justify-between text-xs mb-1"><span className="font-bold text-slate-600">{editor.name}</span><span className="font-mono text-slate-500">{count}</span></div>
                               <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden"><AnimatedBar width={max === 0 ? 0 : (count / max) * 100} colorClass={theme.bar} /></div>
                             </div>
                           )
                        })}
                      </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {view === 'manage' && (
            <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 pb-24">
              <h2 className="text-2xl font-bold text-slate-800">System Management</h2>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Tv size={18}/> 節目列表 (Programs)</h3><button onClick={() => { setEditingProgram({}); setIsProgramModalOpen(true); }} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-md font-bold hover:bg-slate-700 transition">Add</button></div>
                <div className="p-0 overflow-x-auto"><table className="w-full text-left text-sm min-w-[600px]"><thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs"><tr><th className="px-5 py-3">節目名稱</th><th className="px-5 py-3">工作天數</th><th className="px-5 py-3">長度</th><th className="px-5 py-3">首播日</th><th className="px-5 py-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{programs.map(p => (<tr key={p.id} className="hover:bg-slate-50/50 transition"><td className="px-5 py-3 font-semibold text-slate-700">{p.name}</td><td className="px-5 py-3 text-slate-500">{p.workDays} Days</td><td className="px-5 py-3 text-slate-500">{p.duration}</td><td className="px-5 py-3 text-slate-500"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{p.premiereDay}</span></td><td className="px-5 py-3 text-right space-x-2"><button onClick={() => { setEditingProgram(p); setIsProgramModalOpen(true); }} className="text-indigo-600 hover:underline">Edit</button><button onClick={() => deleteProgram(p.id)} className="text-red-500 hover:underline">Del</button></td></tr>))}</tbody></table></div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2"><User size={18}/> 剪輯師 (Editors)</h3><button onClick={() => { setEditingEditor({}); setIsEditorModalOpen(true); }} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-md font-bold hover:bg-slate-700 transition">Add</button></div>
                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {displayEditors.map(e => {
                     const theme = getTheme(e.color);
                     return (
                      <div key={e.id} className="group relative border border-slate-200 rounded-xl p-4 hover:shadow-md transition bg-white">
                        <div className="flex justify-between items-start mb-2"><div className={`w-8 h-8 rounded-full ${theme.bar} flex items-center justify-center text-xs font-bold text-white opacity-80`}>{e.name[0]}</div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button onClick={() => { setEditingEditor(e); setIsEditorModalOpen(true); }} className="p-1 hover:bg-slate-100 rounded"><Edit3 size={14} className="text-slate-500"/></button><button onClick={() => deleteEditor(e.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 size={14} className="text-red-400"/></button></div></div>
                        <p className="font-bold text-slate-700 truncate">{e.name}</p>
                        <div className={`text-[10px] mt-2 inline-block px-1.5 py-0.5 rounded ${theme.pill}`}>Tag Color</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Floating Button (手機版上移，避免被導航欄擋住) */}
        {view === 'calendar' && (
          <button 
            onClick={() => { setEditingTask({}); setIsTaskModalOpen(true); }} 
            className="absolute bottom-20 right-6 md:bottom-8 md:right-8 bg-slate-800 hover:bg-slate-900 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 z-30"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        )}
      </main>

      {/* 🔥 3. 手機版底部導航欄 (Bottom Navigation Bar) 
          - md:hidden: 電腦版隱藏
          - fixed bottom-0: 固定在底部
          - pb-safe: 避開 iPhone 下方橫條
      */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-50 pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <NavBtn icon={<LayoutGrid size={22} />} label="Calendar" active={view === 'calendar'} onClick={() => setView('calendar')} />
        <NavBtn icon={<BarChart3 size={22} />} label="Insights" active={view === 'stats'} onClick={() => setView('stats')} />
        <NavBtn icon={<Settings size={22} />} label="Settings" active={view === 'manage'} onClick={() => setView('manage')} />
      </nav>

      {/* Modals (保持不變) */}
      {isTaskModalOpen && (<div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-100 overflow-hidden animate-in zoom-in-95 duration-200"><div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-base text-slate-800">Task Details</h3><button onClick={() => setIsTaskModalOpen(false)}><X size={20} className="text-slate-400"/></button></div><div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">{editingTask.id && editingTask.startDate && editingTask.endDate && (<div className={`p-2 rounded-md text-xs font-bold flex items-center gap-2 ${getTaskStatus(editingTask) === 'completed' ? 'bg-indigo-50 text-indigo-600' : getTaskStatus(editingTask) === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{getTaskStatus(editingTask) === 'completed' ? <CheckCircle2 size={14}/> : getTaskStatus(editingTask) === 'active' ? <PlayCircle size={14}/> : <Clock size={14}/>}{getTaskStatus(editingTask) === 'completed' ? '已完成' : getTaskStatus(editingTask) === 'active' ? '進行中' : '未開始'}</div>)}<div className="space-y-1"><label className="block text-[11px] font-bold text-slate-500 uppercase">節目</label><select className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm" value={editingTask.show || ''} onChange={e => setEditingTask({...editingTask, show: e.target.value})}><option value="" disabled>選擇節目...</option>{programs.map(p => <option key={p.id} value={p.name}>{p.name} ({p.duration})</option>)}</select></div><div className="grid grid-cols-5 gap-3"><div className="col-span-2 space-y-1"><label className="block text-[11px] font-bold text-slate-500 uppercase">集數</label><input type="text" className="w-full p-2 border border-slate-200 rounded-md text-sm" value={editingTask.episode || ''} onChange={e => setEditingTask({...editingTask, episode: e.target.value})} /></div><div className="col-span-3 space-y-1"><label className="block text-[11px] font-bold text-slate-500 uppercase">剪輯師</label><select className="w-full p-2 bg-white border border-slate-200 rounded-md text-sm" value={editingTask.editor || ''} onChange={e => setEditingTask({...editingTask, editor: e.target.value})}><option value="" disabled>選擇...</option>{displayEditors.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}</select></div></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="block text-[11px] font-bold text-slate-500 uppercase">開始</label><input type="date" className="w-full p-2 border border-slate-200 rounded-md text-sm" value={editingTask.startDate || ''} onChange={e => setEditingTask({...editingTask, startDate: e.target.value})} /></div><div className="space-y-1"><label className="block text-[11px] font-bold text-slate-500 uppercase">結束</label><input type="date" className="w-full p-2 border border-slate-200 rounded-md text-sm" value={editingTask.endDate || ''} onChange={e => setEditingTask({...editingTask, endDate: e.target.value})} /></div></div><div className="space-y-1"><label className="block text-[11px] font-bold text-slate-500 uppercase">備註 (Note)</label><textarea className="w-full p-2 border border-slate-200 rounded-md text-sm h-20 resize-none outline-none focus:border-slate-400 transition" placeholder="輸入備註..." value={editingTask.note || ''} onChange={e => setEditingTask({...editingTask, note: e.target.value})} /></div></div><div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between">{editingTask.id ? <button onClick={() => deleteTask(editingTask.id!)} className="text-red-500 hover:bg-red-50 px-2 rounded"><Trash2 size={16}/></button> : <div/>} <div className="flex gap-2"><button onClick={() => setIsTaskModalOpen(false)} className="px-4 py-1.5 text-sm font-bold text-slate-500">Cancel</button><button onClick={saveTask} className="bg-slate-800 text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-sm">Save</button></div></div></div></div>)}
      {isProgramModalOpen && (<div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"><div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800">Edit Program</h3><button onClick={() => setIsProgramModalOpen(false)}><X size={20}/></button></div><div className="p-5 space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">名稱</label><input className="w-full p-2 border rounded mt-1 text-sm" value={editingProgram.name || ''} onChange={e => setEditingProgram({...editingProgram, name: e.target.value})} /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 uppercase">長度</label><input className="w-full p-2 border rounded mt-1 text-sm" placeholder="e.g. 10min" value={editingProgram.duration || ''} onChange={e => setEditingProgram({...editingProgram, duration: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">工作天</label><input type="number" className="w-full p-2 border rounded mt-1 text-sm" value={editingProgram.workDays || ''} onChange={e => setEditingProgram({...editingProgram, workDays: Number(e.target.value)})} /></div></div><div><label className="text-xs font-bold text-slate-500 uppercase">首播日</label><input className="w-full p-2 border rounded mt-1 text-sm" placeholder="e.g. 週五" value={editingProgram.premiereDay || ''} onChange={e => setEditingProgram({...editingProgram, premiereDay: e.target.value})} /></div></div><div className="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2"><button onClick={() => setIsProgramModalOpen(false)} className="px-3 py-1 text-sm font-bold text-slate-500">Cancel</button><button onClick={saveProgram} className="bg-slate-800 text-white px-4 py-1.5 rounded text-sm font-bold">Save</button></div></div></div>)}
      {isEditorModalOpen && (<div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"><div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center"><h3 className="font-bold text-slate-800">Edit Editor</h3><button onClick={() => setIsEditorModalOpen(false)}><X size={20}/></button></div><div className="p-5 space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase">姓名</label><input className="w-full p-2 border rounded mt-1 text-sm" value={editingEditor.name || ''} onChange={e => setEditingEditor({...editingEditor, name: e.target.value})} /></div><div><label className="text-xs font-bold text-slate-500 uppercase">代表色</label><div className="grid grid-cols-4 gap-2 mt-2">{COLOR_OPTIONS.map(c => (<button key={c.label} onClick={() => setEditingEditor({...editingEditor, color: c.value})} className={`h-8 rounded border-2 transition ${editingEditor.color === c.value ? 'border-slate-800' : 'border-transparent'} ${c.value.split(' ')[0]}`}></button>))}</div></div></div><div className="px-5 py-3 bg-slate-50 border-t flex justify-end gap-2"><button onClick={() => setIsEditorModalOpen(false)} className="px-3 py-1 text-sm font-bold text-slate-500">Cancel</button><button onClick={saveEditor} className="bg-slate-800 text-white px-4 py-1.5 rounded text-sm font-bold">Save</button></div></div></div>)}
    </div>
  );
}

const NavBtn = ({ icon, active, onClick, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all group cursor-pointer ${active ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
    {icon}
    <span className="text-[10px] font-bold opacity-80 group-hover:opacity-100">{label}</span>
  </button>
);

export default App;
