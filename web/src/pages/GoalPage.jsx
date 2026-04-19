import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faCirclePlus, faFloppyDisk, faPenToSquare, faXmark } from "@fortawesome/free-solid-svg-icons";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import RichTextContent from "../components/RichTextContent";
import RichTextEditor from "../components/RichTextEditor";

export default function GoalPage() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [goal, setGoal] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", deadline_at: "", tags: "", priority: 1 });
  const [goalForm, setGoalForm] = useState({ title: "", description: "", deadline_at: "", tags: "", priority: 1 });
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isEditGoalModalOpen, setIsEditGoalModalOpen] = useState(false);

  async function refresh() {
    const [goals, goalProjects] = await Promise.all([api.listGoals(), api.listProjects(goalId)]);
    setGoal(goals.find((g) => String(g.id) === String(goalId)) || null);
    setProjects(goalProjects);
  }

  function formatDate(isoDate) {
    if (!isoDate) return "No deadline";
    const value = new Date(isoDate);
    if (Number.isNaN(value.getTime())) return "No deadline";
    return value.toLocaleString();
  }

  function toInputDateTime(value) {
    if (!value) return "";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "";
    const tzOffset = dt.getTimezoneOffset() * 60000;
    return new Date(dt.getTime() - tzOffset).toISOString().slice(0, 16);
  }

  useEffect(() => {
    refresh();
  }, [goalId]);

  async function createProject(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await api.createProject(goalId, {
      title: form.title.trim(),
      description: form.description,
      deadline_at: form.deadline_at ? new Date(form.deadline_at).toISOString() : null,
      tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      priority: Number(form.priority || 1),
    });
    setForm({ title: "", description: "", deadline_at: "", tags: "", priority: 1 });
    setIsAddProjectModalOpen(false);
    refresh();
  }

  function openEditGoalModal() {
    if (!goal) return;
    setGoalForm({
      title: goal.title || "",
      description: goal.description || "",
      deadline_at: toInputDateTime(goal.deadline_at),
      tags: (goal.tags || []).join(", "),
      priority: goal.priority ?? 1,
    });
    setIsEditGoalModalOpen(true);
  }

  async function saveGoalEdit(e) {
    e.preventDefault();
    if (!goal || !goalForm.title.trim()) return;
    await api.updateGoal(goal.id, {
      title: goalForm.title.trim(),
      description: goalForm.description,
      deadline_at: goalForm.deadline_at ? new Date(goalForm.deadline_at).toISOString() : null,
      tags: goalForm.tags ? goalForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      priority: Number(goalForm.priority || 1),
    });
    setIsEditGoalModalOpen(false);
    refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button className="rounded border border-slate-600 px-3 py-1 text-sm" title="Go back to Home" onClick={() => navigate("/")}>
          <FontAwesomeIcon icon={faArrowLeft} className="mr-1" />
          Back
        </button>
        <button
          type="button"
          className="rounded bg-indigo-500 px-4 py-2 font-medium text-white"
          title="Add a new project to this goal"
          onClick={() => setIsAddProjectModalOpen(true)}
        >
          <FontAwesomeIcon icon={faCirclePlus} className="mr-2" />
          Add Project
        </button>
      </div>
      <h1 className="text-3xl font-bold">🎯 Goal Projects</h1>

      <section className="rounded-lg border border-indigo-700/70 bg-slate-900 p-4">
        <h2 className="mb-3 text-xl font-semibold">🌟 Goal Overview</h2>
        {goal ? (
          <div className="space-y-2">
            <div className="text-2xl font-bold text-indigo-200">{goal.title}</div>
            <RichTextContent value={goal.description} className="rich-content text-sm" emptyLabel="🫥 No description yet" />
            <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
              <div>📅 Deadline: {formatDate(goal.deadline_at)}</div>
              <div>⚡ Priority: P{goal.priority}</div>
              <div>🏷️ Tags: {(goal.tags || []).join(", ") || "-"}</div>
            </div>
            <div>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                title="Edit this goal"
                onClick={openEditGoalModal}
              >
                <FontAwesomeIcon icon={faPenToSquare} className="mr-1" />
                Edit Goal
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Goal details unavailable.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">🗂️ Projects Grid</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <button
              key={project.id}
              className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-left shadow-sm transition hover:border-indigo-500"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <h3 className="font-semibold">{project.title}</h3>
              <div className="mt-1">
                <RichTextContent value={project.description} className="rich-content text-sm" emptyLabel="🫥 No description yet" />
              </div>
              <p className="mt-2 text-xs text-slate-400">🏷️ Tags: {(project.tags || []).join(", ") || "-"}</p>
            </button>
          ))}
        </div>
      </section>

      {isAddProjectModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsAddProjectModalOpen(false)}
        >
          <section
            className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">📦 Add Project</h2>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                title="Close add project form"
                onClick={() => setIsAddProjectModalOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} className="mr-1" />
                Close
              </button>
            </div>
            <form className="grid gap-2 md:grid-cols-2" onSubmit={createProject}>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="📦 Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="datetime-local" value={form.deadline_at} onChange={(e) => setForm({ ...form, deadline_at: e.target.value })} />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Project description</label>
                <RichTextEditor value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="Project description" />
              </div>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="🏷️ Tags (comma separated)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="number" min={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              <button className="rounded bg-indigo-500 px-4 py-2 font-medium text-white md:col-span-2" type="submit" title="Save and create this project">
                <FontAwesomeIcon icon={faCirclePlus} className="mr-2" />
                Create Project
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {isEditGoalModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsEditGoalModalOpen(false)}
        >
          <section
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">✏️ Edit Goal</h2>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-1 text-sm"
                title="Close edit goal form"
                onClick={() => setIsEditGoalModalOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} className="mr-1" />
                Close
              </button>
            </div>
            <form className="grid gap-2 md:grid-cols-2" onSubmit={saveGoalEdit}>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="🎯 Goal title" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="datetime-local" value={goalForm.deadline_at} onChange={(e) => setGoalForm({ ...goalForm, deadline_at: e.target.value })} />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Goal description</label>
                <RichTextEditor value={goalForm.description} onChange={(value) => setGoalForm({ ...goalForm, description: value })} placeholder="Goal description" />
              </div>
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" placeholder="🏷️ Tags (comma separated)" value={goalForm.tags} onChange={(e) => setGoalForm({ ...goalForm, tags: e.target.value })} />
              <input className="rounded border border-slate-600 bg-slate-800 px-3 py-2" type="number" min={1} value={goalForm.priority} onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })} />
              <button className="rounded bg-indigo-500 px-4 py-2 font-medium text-white md:col-span-2" type="submit" title="Save changes to this goal">
                <FontAwesomeIcon icon={faFloppyDisk} className="mr-2" />
                Save Goal Changes
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
