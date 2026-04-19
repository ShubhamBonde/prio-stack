import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import TaskDetailsModal from "../components/TaskDetailsModal";

export default function InboxPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [projectsById, setProjectsById] = useState({});
  const [goalsById, setGoalsById] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    overdue: false,
    today: false,
    upcoming: false,
    untracked: false,
  });

  async function refresh() {
    const goalList = await api.listGoals();
    const goalsLookup = Object.fromEntries(goalList.map((goal) => [goal.id, goal]));
    const projectGroups = await Promise.all(goalList.map((goal) => api.listProjects(goal.id)));
    const projectList = projectGroups.flat();
    const projectsLookup = Object.fromEntries(projectList.map((project) => [project.id, project]));
    const taskGroups = await Promise.all(projectList.map((project) => api.listTasks(project.id)));
    const allTasks = taskGroups.flat();

    setGoalsById(goalsLookup);
    setProjectsById(projectsLookup);
    setTasks(allTasks);
    return { allTasks };
  }

  useEffect(() => {
    refresh();
  }, []);

  const grouped = useMemo(() => buildInboxGroups(tasks, projectsById, goalsById), [tasks, projectsById, goalsById]);

  function toggleSection(sectionKey) {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">📥 Inbox</h1>
        <button
          type="button"
          className="rounded border border-slate-600 px-3 py-1 text-sm"
          title="Go back to Home"
          onClick={() => navigate("/")}
        >
          Back to Home
        </button>
      </div>

      <TaskSection
        sectionKey="overdue"
        title="⚠️ Overdue Tasks"
        subtitle="Pending tasks with due date before today"
        tasks={grouped.overdue}
        projectsById={projectsById}
        goalsById={goalsById}
        isCollapsed={collapsedSections.overdue}
        onToggle={toggleSection}
        onOpenTask={setSelectedTask}
      />
      <TaskSection
        sectionKey="today"
        title="🪣 Today's Bucket"
        subtitle="Pending tasks due today"
        tasks={grouped.today}
        projectsById={projectsById}
        goalsById={goalsById}
        isCollapsed={collapsedSections.today}
        onToggle={toggleSection}
        onOpenTask={setSelectedTask}
      />
      <TaskSection
        sectionKey="upcoming"
        title="📅 Upcoming Tasks"
        subtitle="Pending tasks due in the future"
        tasks={grouped.upcoming}
        projectsById={projectsById}
        goalsById={goalsById}
        isCollapsed={collapsedSections.upcoming}
        onToggle={toggleSection}
        onOpenTask={setSelectedTask}
      />
      <TaskSection
        sectionKey="untracked"
        title="🧭 Untracked Tasks"
        subtitle="Pending tasks without any due date"
        tasks={grouped.untracked}
        projectsById={projectsById}
        goalsById={goalsById}
        isCollapsed={collapsedSections.untracked}
        onToggle={toggleSection}
        onOpenTask={setSelectedTask}
      />

      {selectedTask ? (
        <TaskDetailsModal
          task={selectedTask}
          project={projectsById[selectedTask.project_id] || null}
          goal={(projectsById[selectedTask.project_id] && goalsById[projectsById[selectedTask.project_id].goal_id]) || null}
          tasksInProject={tasks.filter((item) => item.project_id === selectedTask.project_id)}
          onClose={() => setSelectedTask(null)}
          onSaved={async () => {
            const { allTasks } = await refresh();
            setSelectedTask(allTasks.find((item) => item.id === selectedTask.id) || null);
          }}
        />
      ) : null}
    </div>
  );
}

function TaskSection({ sectionKey, title, subtitle, tasks, projectsById, goalsById, isCollapsed, onToggle, onOpenTask }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-left"
          onClick={() => onToggle(sectionKey)}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? "Expand section" : "Collapse section"}
        >
          <h2 className="text-xl font-semibold">
            {isCollapsed ? "▶" : "▼"} {title}
          </h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </button>
        <div className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300">{tasks.length} task{tasks.length === 1 ? "" : "s"}</div>
      </div>

      {!isCollapsed ? (
        <>
          {tasks.length === 0 ? <p className="text-sm text-slate-400">No tasks in this section.</p> : null}
          <div className="space-y-2">
            {tasks.map((task) => {
              const project = projectsById[task.project_id];
              const goal = project ? goalsById[project.goal_id] : null;
              return (
                <article key={task.id} className="rounded-md border border-slate-700/90 bg-slate-900/50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button type="button" className="text-left text-sm font-semibold hover:text-indigo-300" onClick={() => onOpenTask(task)}>
                      {task.title}
                    </button>
                    <div className="text-xs text-slate-300">Goal P{goal?.priority ?? "-"} · Task P{task.priority}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Goal: {goal?.title || "Unknown"} · Project: {project?.title || `#${task.project_id}`} · Due: {formatDue(task.due_at)}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

function formatDue(dueAt) {
  if (!dueAt) return "Not set";
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return "Invalid date";
  return due.toLocaleDateString();
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareByGoalPriorityThenTask(a, b) {
  if (a.goalPriority !== b.goalPriority) return b.goalPriority - a.goalPriority;
  if (a.task.priority !== b.task.priority) return b.task.priority - a.task.priority;
  if (a.task.due_at && b.task.due_at) return new Date(a.task.due_at).getTime() - new Date(b.task.due_at).getTime();
  return a.task.title.localeCompare(b.task.title);
}

function buildInboxGroups(tasks, projectsById, goalsById) {
  const pendingTasks = tasks.filter((task) => task.state !== "done");
  const todayKey = toDateKey(new Date());

  const rows = pendingTasks.map((task) => {
    const project = projectsById[task.project_id];
    const goal = project ? goalsById[project.goal_id] : null;
    const due = task.due_at ? new Date(task.due_at) : null;
    const dueKey = due && !Number.isNaN(due.getTime()) ? toDateKey(due) : null;
    return {
      task,
      goalPriority: goal?.priority ?? 0,
      dueKey,
    };
  });

  const overdue = rows
    .filter((row) => row.dueKey && row.dueKey < todayKey)
    .sort(compareByGoalPriorityThenTask)
    .map((row) => row.task);
  const today = rows
    .filter((row) => row.dueKey === todayKey)
    .sort(compareByGoalPriorityThenTask)
    .map((row) => row.task);
  const upcoming = rows
    .filter((row) => row.dueKey && row.dueKey > todayKey)
    .sort(compareByGoalPriorityThenTask)
    .map((row) => row.task);
  const untracked = rows
    .filter((row) => !row.dueKey)
    .sort(compareByGoalPriorityThenTask)
    .map((row) => row.task);

  return { overdue, today, upcoming, untracked };
}
