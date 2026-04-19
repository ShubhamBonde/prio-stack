import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk, faXmark } from "@fortawesome/free-solid-svg-icons";
import { api } from "../api";
import RichTextContent, { isRichTextEmpty } from "./RichTextContent";
import RichTextEditor from "./RichTextEditor";

function toInputDateTime(value) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const tzOffset = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return "Not set";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Invalid date";
  return dt.toLocaleString();
}

export default function TaskDetailsModal({ task, project, goal, tasksInProject, onClose, onSaved }) {
  const [taskForm, setTaskForm] = useState({
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
  });
  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    deadline_at: "",
    tags: "",
    priority: 1,
  });
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!task) return;
    setTaskForm({
      parent_id: task.parent_id ? String(task.parent_id) : "",
      title: task.title || "",
      description: task.description || "",
      notes: task.notes || "",
      state: task.state || "todo",
      priority: task.priority ?? 2,
      due_at: toInputDateTime(task.due_at),
      alarm_enabled: Boolean(task.alarm_enabled),
      required_frequency: task.required_frequency || "daily",
      frequency_days: task.frequency_days ?? 1,
    });
  }, [task]);

  useEffect(() => {
    if (!project) return;
    setProjectForm({
      title: project.title || "",
      description: project.description || "",
      deadline_at: toInputDateTime(project.deadline_at),
      tags: (project.tags || []).join(", "),
      priority: project.priority ?? 1,
    });
  }, [project]);

  const parentOptions = useMemo(() => {
    return (tasksInProject || []).filter((candidate) => candidate.id !== task.id);
  }, [tasksInProject, task.id]);

  async function saveTask(e) {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    setError("");
    setIsSavingTask(true);
    try {
      await api.updateTask(task.id, {
        parent_id: taskForm.parent_id ? Number(taskForm.parent_id) : null,
        title: taskForm.title.trim(),
        description: taskForm.description,
        notes: taskForm.notes,
        state: taskForm.state,
        priority: Number(taskForm.priority),
        due_at: taskForm.due_at ? new Date(taskForm.due_at).toISOString() : null,
        alarm_enabled: Boolean(taskForm.alarm_enabled),
        required_frequency: taskForm.required_frequency,
        frequency_days: Number(taskForm.frequency_days),
      });
      await onSaved();
    } catch (err) {
      setError(err?.message || "Failed to update task.");
    } finally {
      setIsSavingTask(false);
    }
  }

  async function saveProject(e) {
    e.preventDefault();
    if (!project || !projectForm.title.trim()) return;
    setError("");
    setIsSavingProject(true);
    try {
      await api.updateProject(project.id, {
        title: projectForm.title.trim(),
        description: projectForm.description,
        deadline_at: projectForm.deadline_at ? new Date(projectForm.deadline_at).toISOString() : null,
        tags: projectForm.tags
          ? projectForm.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        priority: Number(projectForm.priority || 1),
      });
      await onSaved();
    } catch (err) {
      setError(err?.message || "Failed to update project.");
    } finally {
      setIsSavingProject(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <section className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">🧩 Task Details</h2>
          <button type="button" className="rounded border border-slate-600 px-3 py-1 text-sm" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} className="mr-1" />
            Close
          </button>
        </div>

        {error ? <div className="mb-3 rounded border border-rose-700 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">{error}</div> : null}

        <div className="mb-5 grid gap-2 rounded border border-slate-700 bg-slate-950/40 p-3 text-sm text-slate-300 md:grid-cols-2">
          <div>Goal: {goal?.title || "Unknown goal"}</div>
          <div>Project: {project?.title || "Unknown project"}</div>
          <div>Task ID: #{task.id}</div>
          <div>Due: {formatDate(task.due_at)}</div>
          <div>Created: {formatDate(task.created_at)}</div>
          <div>Updated: {formatDate(task.updated_at)}</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <form className="space-y-2 rounded border border-indigo-700/50 bg-slate-950/40 p-4" onSubmit={saveTask}>
            <h3 className="text-lg font-semibold text-indigo-200">Edit Task</h3>
            <select className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" value={taskForm.parent_id} onChange={(e) => setTaskForm({ ...taskForm, parent_id: e.target.value })}>
              <option value="">No parent task</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
            <input className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Task title" />
            <input className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" type="datetime-local" value={taskForm.due_at} onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })} />
            <div>
              <label className="mb-1 block text-xs text-slate-400">Description</label>
              <RichTextEditor value={taskForm.description} onChange={(value) => setTaskForm({ ...taskForm, description: value })} placeholder="Task description" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Notes</label>
              <RichTextEditor value={taskForm.notes} onChange={(value) => setTaskForm({ ...taskForm, notes: value })} placeholder="Task notes" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2" value={taskForm.state} onChange={(e) => setTaskForm({ ...taskForm, state: e.target.value })}>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
              <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={taskForm.alarm_enabled} onChange={(e) => setTaskForm({ ...taskForm, alarm_enabled: e.target.checked })} />
              Alarm enabled
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select className="rounded border border-slate-600 bg-slate-800 px-3 py-2" value={taskForm.required_frequency} onChange={(e) => setTaskForm({ ...taskForm, required_frequency: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="number" min={1} max={30} value={taskForm.frequency_days} onChange={(e) => setTaskForm({ ...taskForm, frequency_days: e.target.value })} />
            </div>
            <button className="w-full rounded bg-indigo-500 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSavingTask || !taskForm.title.trim()}>
              <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
              {isSavingTask ? "Saving Task..." : "Save Task"}
            </button>
          </form>

          <div className="space-y-3">
            <section className="rounded border border-slate-700 bg-slate-950/40 p-4">
              <h3 className="mb-2 text-lg font-semibold">Task Description Preview</h3>
              <RichTextContent
                value={taskForm.description}
                className="rich-content text-sm"
                emptyLabel="No task description."
              />
              <h3 className="mb-2 mt-4 text-lg font-semibold">Task Notes Preview</h3>
              <RichTextContent value={taskForm.notes} className="rich-content text-sm" emptyLabel="No task notes." />
            </section>

            {project ? (
              <form className="space-y-2 rounded border border-emerald-700/50 bg-slate-950/40 p-4" onSubmit={saveProject}>
                <h3 className="text-lg font-semibold text-emerald-200">Edit Project (from task modal)</h3>
                <input className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} placeholder="Project title" />
                <input className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" type="datetime-local" value={projectForm.deadline_at} onChange={(e) => setProjectForm({ ...projectForm, deadline_at: e.target.value })} />
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Project Description</label>
                  <RichTextEditor value={projectForm.description} onChange={(value) => setProjectForm({ ...projectForm, description: value })} placeholder="Project description" />
                </div>
                <input className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" value={projectForm.tags} onChange={(e) => setProjectForm({ ...projectForm, tags: e.target.value })} placeholder="Tags (comma separated)" />
                <input className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2" type="number" min={1} value={projectForm.priority} onChange={(e) => setProjectForm({ ...projectForm, priority: e.target.value })} />
                <button className="w-full rounded bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSavingProject || !projectForm.title.trim()}>
                  <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                  {isSavingProject ? "Saving Project..." : "Save Project"}
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {isRichTextEmpty(taskForm.description) && isRichTextEmpty(taskForm.notes) ? (
          <p className="mt-3 text-xs text-slate-500">Tip: the rich editor supports headings, bullet lists, links, and code blocks.</p>
        ) : null}
      </section>
    </div>
  );
}
