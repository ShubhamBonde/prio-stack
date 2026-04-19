import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsUpDown, faCirclePlus, faFlag, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import RichTextContent from "../components/RichTextContent";
import RichTextEditor from "../components/RichTextEditor";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function GoalCard({ goal, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: String(goal.id) });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const navigate = useNavigate();
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate font-semibold" title={goal.title}>
          {goal.title}
        </h3>
        <div className="flex gap-2">
          <button className="rounded border border-slate-600 px-2 py-1 text-xs" title="Reorder this goal" {...attributes} {...listeners}>
            <FontAwesomeIcon icon={faArrowsUpDown} className="mr-1" />
            Reorder
          </button>
          <button
            className="rounded border border-rose-700 px-2 py-1 text-xs text-rose-300"
            title="Delete this goal and all related content"
            onClick={() => onDelete(goal)}
          >
            <FontAwesomeIcon icon={faTrashCan} className="mr-1" />
            Delete
          </button>
        </div>
      </div>
      <div className="mb-2">
        <RichTextContent value={goal.description} className="rich-content text-sm" emptyLabel="🫥 No description yet" />
      </div>
      <button className="rounded bg-indigo-500 px-3 py-1 text-sm" title="Open goal details" onClick={() => navigate(`/goals/${goal.id}`)}>
        <FontAwesomeIcon icon={faFlag} className="mr-1" />
        Open Goal
      </button>
    </div>
  );
}

export default function HomePage() {
  const [goals, setGoals] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({ title: "", description: "", deadline_at: "", tags: "", priority: 1 });
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  async function refresh() {
    const goalData = await api.listGoals();
    setGoals(goalData);

    const projectGroups = await Promise.all(goalData.map((goal) => api.listProjects(goal.id)));
    const flatProjects = projectGroups.flat();
    setProjects(flatProjects);

    const taskGroups = await Promise.all(flatProjects.map((project) => api.listTasks(project.id)));
    setTasks(taskGroups.flat());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.createGoal({
      title: form.title.trim(),
      description: form.description,
      deadline_at: form.deadline_at ? new Date(form.deadline_at).toISOString() : null,
      tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      priority: Number(form.priority || 1),
    });
    setForm({ title: "", description: "", deadline_at: "", tags: "", priority: 1 });
    setIsAddGoalModalOpen(false);
    refresh();
  }

  async function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = goals.findIndex((goal) => String(goal.id) === active.id);
    const newIndex = goals.findIndex((goal) => String(goal.id) === over.id);
    const reordered = arrayMove(goals, oldIndex, newIndex);
    setGoals(reordered);
    const payload = reordered.map((goal, idx) => ({ id: goal.id, priority: reordered.length - idx }));
    await api.reorderGoals(payload);
  }

  async function handleDeleteGoal(goal) {
    const ok = window.confirm(
      `Delete goal "${goal.title}" and all its projects/tasks? This action cannot be undone.`
    );
    if (!ok) return;
    await api.deleteGoal(goal.id);
    refresh();
  }

  const heatmap = buildGlobalHeatmapData(tasks, projects, heatmapYear);
  const streaks = buildCompletionStreaks(tasks);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">🚀 Life Goals Stack</h1>
        <button
          type="button"
          className="rounded bg-indigo-500 px-4 py-2 font-medium text-white"
          title="Create a new goal"
          onClick={() => setIsAddGoalModalOpen(true)}
        >
          <FontAwesomeIcon icon={faCirclePlus} className="mr-2" />
          Add Goal
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-indigo-700/50 bg-indigo-950/20 p-3">
              <div className="text-xs text-indigo-300">Current Streak</div>
              <div className="text-2xl font-bold">{streaks.current} day{streaks.current === 1 ? "" : "s"}</div>
              <div className="text-xs text-slate-400">Consecutive days with completed tasks (through today)</div>
            </div>
            <div className="rounded border border-emerald-700/50 bg-emerald-950/20 p-3">
              <div className="text-xs text-emerald-300">Best Streak</div>
              <div className="text-2xl font-bold">{streaks.best} day{streaks.best === 1 ? "" : "s"}</div>
              <div className="text-xs text-slate-400">Longest run of daily task completions</div>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">🗓️ All Projects Heatmap</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                onClick={() => setHeatmapYear((year) => year - 1)}
              >
                ← Prev
              </button>
              <span className="min-w-[4rem] text-center font-medium">{heatmapYear}</span>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                onClick={() => setHeatmapYear((year) => year + 1)}
              >
                Next →
              </button>
            </div>
          </div>

          <div className="heatmap-scroll overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="mb-1 ml-8 flex gap-1 text-[10px] text-slate-400">
                {heatmap.columns.map((column, index) => {
                  const month = heatmap.monthHeaders.find((entry) => entry.column === index);
                  return (
                    <span key={`month-${column.weekStart}`} className="w-3">
                      {month ? month.label : ""}
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <div className="mt-1 flex flex-col gap-1 text-[10px] text-slate-400">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="h-3 leading-3">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="relative flex gap-1">
                  {heatmap.columns.map((column) => (
                    <div key={column.weekStart} className="flex flex-col gap-1">
                      {column.days.map((day) => (
                      <button
                          type="button"
                          key={day.dateKey}
                          className={`h-3 w-3 rounded-[2px] border border-slate-700 ${day.inYear ? contributionToneClass(day.count) : "bg-slate-800/30"}`}
                        onMouseEnter={(event) => {
                          if (!day.inYear) {
                            setHoveredDay(null);
                            return;
                          }
                          setHoveredDay(day);
                          setTooltipPos({ x: event.clientX + 14, y: event.clientY + 14 });
                        }}
                        onMouseMove={(event) => {
                          if (!day.inYear) return;
                          setTooltipPos({ x: event.clientX + 14, y: event.clientY + 14 });
                        }}
                        onMouseLeave={() => setHoveredDay(null)}
                          aria-label={day.label}
                        />
                      ))}
                    </div>
                  ))}
                  {hoveredDay ? (
                    <div
                      className="pointer-events-none fixed z-50 w-72 rounded-md border border-slate-600 bg-slate-950/95 p-3 text-left shadow-lg"
                      style={{ left: tooltipPos.x, top: tooltipPos.y }}
                    >
                      <div className="text-xs text-slate-400">{hoveredDay.label}</div>
                      <div className="mb-2 text-sm font-semibold text-emerald-300">
                        ✅ {hoveredDay.count} completed task{hoveredDay.count === 1 ? "" : "s"}
                      </div>
                      {hoveredDay.projects.length === 0 ? (
                        <div className="text-xs text-slate-400">No project activity.</div>
                      ) : (
                        <div className="space-y-1">
                          {hoveredDay.projects.map((project) => (
                            <div key={project.projectId} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-slate-200">{project.projectTitle}</span>
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">{project.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-slate-400">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`h-3 w-3 rounded-[2px] border border-slate-700 ${legendToneClass(level)}`} />
            ))}
            <span>More</span>
          </div>
        </section>

        {goals.length === 0 ? (
          <section className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center">
            <p className="max-w-xl text-slate-300">
              Currently no goals are being tracked.{" "}
              <button
                type="button"
                className="font-semibold text-indigo-400 underline underline-offset-2 hover:text-indigo-300"
                onClick={() => setIsAddGoalModalOpen(true)}
              >
                Add a goal
              </button>{" "}
              to start tracking.
            </p>
          </section>
        ) : (
          <section className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h2 className="text-xl font-semibold">Goals</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={goals.map((g) => String(g.id))} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {goals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} onDelete={handleDeleteGoal} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        )}
      </div>

      {isAddGoalModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsAddGoalModalOpen(false)}
        >
          <section
            className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">✨ Add Goal</h2>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                onClick={() => setIsAddGoalModalOpen(false)}
              >
                Close
              </button>
            </div>
            <form className="grid gap-2 md:grid-cols-2" onSubmit={handleCreate}>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="🎯 Goal title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="datetime-local" value={form.deadline_at} onChange={(e) => setForm({ ...form, deadline_at: e.target.value })} />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Goal description</label>
                <RichTextEditor value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Goal description" />
              </div>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="🏷️ Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="number" min={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              <button className="rounded bg-indigo-500 px-4 py-2 font-medium text-white md:col-span-2" type="submit" title="Save and create this goal">
                <FontAwesomeIcon icon={faCirclePlus} className="mr-2" />
                Create Goal
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return start;
}

function buildGlobalHeatmapData(tasks, projects, year) {
  const projectNames = Object.fromEntries(projects.map((project) => [project.id, project.title]));
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const gridStart = startOfWeek(yearStart);
  const gridEnd = new Date(yearEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const dailyStats = {};
  for (const task of tasks) {
    if (task.state !== "done" || !task.updated_at) continue;
    const completedAt = new Date(task.updated_at);
    if (Number.isNaN(completedAt.getTime()) || completedAt.getFullYear() !== year) continue;
    const dateKey = toDateKey(completedAt);
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        count: 0,
        projects: {},
      };
    }
    dailyStats[dateKey].count += 1;
    const projectTitle = projectNames[task.project_id] || `Project #${task.project_id}`;
    dailyStats[dateKey].projects[task.project_id] = {
      projectId: task.project_id,
      projectTitle,
      count: (dailyStats[dateKey].projects[task.project_id]?.count || 0) + 1,
    };
  }

  const columns = [];
  const monthHeaders = [];
  let cursor = new Date(gridStart);
  let weekIndex = 0;

  while (cursor <= gridEnd) {
    const weekStart = new Date(cursor);
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const current = new Date(weekStart);
      current.setDate(weekStart.getDate() + i);
      const dateKey = toDateKey(current);
      const stats = dailyStats[dateKey];
      const projectsForDay = stats
        ? Object.values(stats.projects).sort((a, b) => b.count - a.count || a.projectTitle.localeCompare(b.projectTitle))
        : [];
      days.push({
        dateKey,
        count: stats?.count || 0,
        inYear: current.getFullYear() === year,
        monthIndex: current.getMonth(),
        label: current.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        projects: projectsForDay,
      });
    }
    columns.push({ weekStart: toDateKey(weekStart), days });

    const firstDayInWeek = days.find((day) => day.inYear);
    if (firstDayInWeek) {
      const monthIndex = firstDayInWeek.monthIndex;
      const last = monthHeaders[monthHeaders.length - 1];
      if (!last || last.label !== MONTH_LABELS[monthIndex]) {
        monthHeaders.push({ label: MONTH_LABELS[monthIndex], column: weekIndex });
      }
    }

    cursor.setDate(cursor.getDate() + 7);
    weekIndex += 1;
  }

  return { columns, monthHeaders };
}

function buildCompletionStreaks(tasks) {
  const completedDayKeys = new Set();
  for (const task of tasks) {
    if (task.state !== "done" || !task.updated_at) continue;
    const completedAt = new Date(task.updated_at);
    if (Number.isNaN(completedAt.getTime())) continue;
    completedDayKeys.add(toDateKey(completedAt));
  }

  const sortedDays = [...completedDayKeys].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const day of sortedDays) {
    const currentDate = new Date(`${day}T00:00:00`);
    if (!prev) {
      run = 1;
    } else {
      const diffDays = Math.round((currentDate.getTime() - prev.getTime()) / 86400000);
      run = diffDays === 1 ? run + 1 : 1;
    }
    best = Math.max(best, run);
    prev = currentDate;
  }

  const today = new Date();
  const todayKey = toDateKey(today);
  let current = 0;
  if (completedDayKeys.has(todayKey)) {
    current = 1;
    const walk = new Date(today);
    while (current < 3650) {
      walk.setDate(walk.getDate() - 1);
      if (!completedDayKeys.has(toDateKey(walk))) break;
      current += 1;
    }
  }

  return { current, best };
}

function contributionToneClass(count) {
  if (count <= 0) return "bg-slate-800/80";
  if (count === 1) return "bg-emerald-900/80";
  if (count <= 3) return "bg-emerald-700/80";
  if (count <= 5) return "bg-emerald-500/80";
  return "bg-emerald-400/90";
}

function legendToneClass(level) {
  if (level === 0) return "bg-slate-800/80";
  if (level === 1) return "bg-emerald-900/80";
  if (level === 2) return "bg-emerald-700/80";
  if (level === 3) return "bg-emerald-500/80";
  return "bg-emerald-400/90";
}
