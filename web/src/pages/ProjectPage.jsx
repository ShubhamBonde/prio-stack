import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCalendarPlus,
  faCircleCheck,
  faCirclePlus,
  faCodeBranch,
  faPenToSquare,
  faTrashCan,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import TaskDetailsModal from "../components/TaskDetailsModal";
import RichTextEditor from "../components/RichTextEditor";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const initialForm = {
  parent_id: "",
  title: "",
  description: "",
  notes: "",
  state: "todo",
  priority: 2,
  due_at: "",
  alarm_enabled: false,
  required_frequency: "daily",
  frequency_days: 1,
};

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [project, setProject] = useState(null);
  const [goal, setGoal] = useState(null);
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState(initialForm);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  async function refresh() {
    const [goals, projectTasks] = await Promise.all([api.listGoals(), api.listTasks(projectId)]);
    const projectGroups = await Promise.all(goals.map((item) => api.listProjects(item.id)));
    const allProjects = projectGroups.flat();
    const currentProject = allProjects.find((item) => String(item.id) === String(projectId)) || null;
    const currentGoal = currentProject ? goals.find((item) => item.id === currentProject.goal_id) || null : null;

    setTasks(projectTasks);
    setProject(currentProject);
    setGoal(currentGoal);
    return { projectTasks };
  }

  useEffect(() => {
    refresh();
  }, [projectId]);

  function toPayload() {
    return {
      ...form,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
      title: form.title.trim(),
      priority: Number(form.priority),
      frequency_days: Number(form.frequency_days),
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
    };
  }

  function openAddTaskModal(parentId = "") {
    setForm({ ...initialForm, parent_id: parentId ? String(parentId) : "" });
    setIsAddTaskModalOpen(true);
  }

  function closeTaskModal() {
    setForm(initialForm);
    setIsAddTaskModalOpen(false);
  }

  async function createTask(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.createTask(projectId, toPayload());
    closeTaskModal();
    refresh();
  }

  async function changeTaskState(taskId, state) {
    await api.updateTask(taskId, { state });
    refresh();
  }

  async function markDone(taskId) {
    await api.completeTask(taskId);
    refresh();
  }

  async function removeTask(task) {
    const ok = window.confirm(`Delete task "${task.title}"? This action cannot be undone.`);
    if (!ok) return;
    await api.deleteTask(task.id);
    refresh();
  }

  function stateLabel(state) {
    if (state === "done") return "✅ Done";
    if (state === "in_progress") return "🚧 In Progress";
    if (state === "blocked") return "⛔ Blocked";
    return "📝 Todo";
  }

  const activeTasks = tasks.filter((task) => task.state !== "done");
  const completedTasks = tasks.filter((task) => task.state === "done");
  const heatmap = buildHeatmapData(tasks, heatmapYear);

  function renderTaskTree(taskList, parentId = null, level = 0) {
    const children = taskList.filter((task) => {
      if (parentId === null) {
        if (task.parent_id == null) return true;
        return !taskList.some((maybeParent) => maybeParent.id === task.parent_id);
      }
      return (task.parent_id ?? null) === parentId;
    });
    if (children.length === 0) return null;

    return children.map((task) => (
      <div key={task.id} className="space-y-1.5">
        <div
          className="flex items-center justify-between gap-2 rounded-md border border-slate-700/90 bg-slate-900/70 px-2 py-1.5"
          style={{ marginLeft: `${level * 14}px` }}
        >
          <div className="min-w-0 flex-1">
            <div
              className={
                task.state === "done"
                  ? "truncate text-sm font-medium text-slate-400 line-through"
                  : "truncate text-sm font-medium"
              }
            >
              <button type="button" className="truncate text-left hover:text-indigo-300" onClick={() => setSelectedTask(task)}>
                {level > 0 ? "↳ " : ""}
                {task.title}
              </button>
            </div>
            <div className="text-xs text-slate-400">{stateLabel(task.state)} · p{task.priority}</div>
          </div>
          <div className="flex items-center gap-1">
            <select
              className="rounded border border-slate-600 bg-slate-800 px-1.5 py-1 text-[11px]"
              value={task.state}
              onChange={(e) => changeTaskState(task.id, e.target.value)}
              title="Change task state"
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
            <button className="inline-flex h-7 items-center justify-center rounded border border-slate-600 px-2 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-800" title="Open full task details" aria-label="Open full task details" onClick={() => setSelectedTask(task)}>
              <FontAwesomeIcon icon={faPenToSquare} className="mr-1" />
              Details
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-indigo-600 text-xs text-indigo-200 transition hover:bg-indigo-900/40"
              title="Add child task"
              aria-label="Add child task"
              onClick={() => openAddTaskModal(task.id)}
            >
              <FontAwesomeIcon icon={faCodeBranch} />
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-600 text-xs text-emerald-300 transition hover:bg-emerald-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              title="Mark complete"
              aria-label="Mark complete"
              onClick={() => markDone(task.id)}
              disabled={task.state === "done"}
            >
              <FontAwesomeIcon icon={faCircleCheck} />
            </button>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-rose-700 text-xs text-rose-300 transition hover:bg-rose-950/40"
              title="Delete task"
              aria-label="Delete task"
              onClick={() => removeTask(task)}
            >
              <FontAwesomeIcon icon={faTrashCan} />
            </button>
          </div>
        </div>
        {renderTaskTree(taskList, task.id, level + 1)}
      </div>
    ));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button className="rounded border border-slate-600 px-3 py-1 text-sm" title="Go back to previous page" onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} className="mr-1" />
          Back
        </button>
        <button
          type="button"
          className="rounded bg-indigo-500 px-4 py-2 font-medium text-white"
          title="Add a new task to this project"
          onClick={() => openAddTaskModal()}
        >
          <FontAwesomeIcon icon={faCirclePlus} className="mr-2" />
          Add Task
        </button>
      </div>
      <h1 className="text-3xl font-bold">📋 Project Tasks</h1>
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">🔥 Project Activity</h2>
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
              <div className="flex gap-1">
                {heatmap.columns.map((column) => (
                  <div key={column.weekStart} className="flex flex-col gap-1">
                    {column.days.map((day) => (
                      <div
                        key={day.dateKey}
                        className={`h-3 w-3 rounded-[2px] border border-slate-700 ${day.inYear ? contributionToneClass(day.count) : "bg-slate-800/30"}`}
                        title={`${day.label}${day.inYear ? ` • ${day.count} completed ${day.count === 1 ? "task" : "tasks"}` : ""}`}
                      />
                    ))}
                  </div>
                ))}
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

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        <h2 className="mb-3 text-xl font-semibold">🧩 Active Tasks</h2>
        <div className="space-y-1.5">
          {activeTasks.length === 0 ? <p className="text-sm text-slate-400">No active tasks.</p> : null}
          {renderTaskTree(activeTasks)}
        </div>
      </section>

      <section className="rounded-lg border border-emerald-800/60 bg-slate-900 p-3">
        <h2 className="mb-3 text-xl font-semibold">✅ Completed</h2>
        <div className="space-y-1.5">
          {completedTasks.length === 0 ? <p className="text-sm text-slate-400">No completed tasks yet.</p> : null}
          {renderTaskTree(completedTasks)}
        </div>
      </section>

      {isAddTaskModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
          onClick={closeTaskModal}
        >
          <section
            className="max-h-[90vh] overflow-y-auto w-full max-w-2xl rounded-t-xl sm:rounded-lg border border-slate-700 bg-slate-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">🧩 Add Task</h2>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                title="Close task form"
                onClick={closeTaskModal}
              >
                <FontAwesomeIcon icon={faXmark} className="mr-1" />
                Close
              </button>
            </div>
            <form className="grid gap-2 md:grid-cols-2" onSubmit={createTask}>
              <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2 md:col-span-2" value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
                <option value="">No parent task</option>
                {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="🧩 Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Description</label>
                <RichTextEditor value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Task description" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Notes</label>
                <RichTextEditor value={form.notes} onChange={(value) => setForm({ ...form, notes: value })} placeholder="Task notes" />
              </div>
              <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
              <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.alarm_enabled} onChange={(e) => setForm({ ...form, alarm_enabled: e.target.checked })} />⏰ Alarm enabled</label>
              <div className="grid grid-cols-2 gap-2">
                <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2" value={form.required_frequency} onChange={(e) => setForm({ ...form, required_frequency: e.target.value })}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                </select>
                <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="number" min={1} max={30} value={form.frequency_days} onChange={(e) => setForm({ ...form, frequency_days: e.target.value })} />
              </div>
              <button className="rounded bg-indigo-500 px-4 py-2 font-medium text-white md:col-span-2" type="submit" title="Save and create this task">
                <FontAwesomeIcon icon={faCalendarPlus} className="mr-2" />
                Create Task
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {selectedTask ? (
        <TaskDetailsModal
          task={selectedTask}
          project={project}
          goal={goal}
          tasksInProject={tasks}
          onClose={() => setSelectedTask(null)}
          onSaved={async () => {
            const { projectTasks } = await refresh();
            setSelectedTask(projectTasks.find((item) => item.id === selectedTask.id) || null);
          }}
        />
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

function buildHeatmapData(tasks, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const gridStart = startOfWeek(yearStart);
  const gridEnd = new Date(yearEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const counts = {};
  for (const task of tasks) {
    if (task.state !== "done" || !task.updated_at) continue;
    const date = new Date(task.updated_at);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) continue;
    const key = toDateKey(date);
    counts[key] = (counts[key] || 0) + 1;
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
      const key = toDateKey(current);
      days.push({
        dateKey: key,
        count: counts[key] || 0,
        inYear: current.getFullYear() === year,
        monthIndex: current.getMonth(),
        label: current.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
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

function contributionToneClass(count) {
  if (count <= 0) return "bg-slate-800/80";
  if (count === 1) return "bg-emerald-900/80";
  if (count === 2) return "bg-emerald-700/80";
  if (count === 3) return "bg-emerald-500/80";
  return "bg-emerald-400/90";
}

function legendToneClass(level) {
  if (level === 0) return "bg-slate-800/80";
  if (level === 1) return "bg-emerald-900/80";
  if (level === 2) return "bg-emerald-700/80";
  if (level === 3) return "bg-emerald-500/80";
  return "bg-emerald-400/90";
}
