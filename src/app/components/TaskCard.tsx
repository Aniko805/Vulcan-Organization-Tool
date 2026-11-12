"use client";

import { useState } from "react";
import Link from "next/link";
import { FieldInput, SecondaryButton } from "@/app/components/AppShell";
import { BTN_SECONDARY } from "@/app/components/ui";
import {
  displayNameFromProfile,
  TASK_COLUMNS,
  type TaskStatus,
  type TaskLink,
  type TaskWithRelations,
} from "@/lib/types";

export default function TaskCard({
  task,
  parentTask,
  childTasks,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onStatusChange,
  onDelete,
}: {
  task: TaskWithRelations;
  parentTask?: TaskLink;
  childTasks: TaskLink[];
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete?: () => void;
}) {
  const [minimized, setMinimized] = useState(true);
  const dueUrgency = getDueUrgency(task.due_date, task.status);
  const dueClass =
    dueUrgency === "overdue"
      ? "text-rose-300"
      : dueUrgency === "today" || dueUrgency === "tomorrow"
        ? "text-amber-300"
        : "";
  const dueText = !task.due_date
    ? "No due date"
    : dueUrgency === "overdue"
      ? `Overdue · ${task.due_date}`
      : dueUrgency === "today"
        ? "Due today"
        : dueUrgency === "tomorrow"
          ? "Due tomorrow"
          : `Due ${task.due_date}`;
  const toggleButton = (
    <button
      type="button"
      onClick={() => setMinimized((current) => !current)}
      aria-expanded={!minimized}
      aria-controls={`task-body-${task.id}`}
      aria-label={minimized ? `Expand ${task.name}` : `Minimize ${task.name}`}
      className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/60 text-zinc-300 transition-all duration-300 ease-out after:absolute after:-inset-1 after:content-[''] hover:border-white/20 hover:bg-zinc-700/60 hover:text-zinc-100 active:scale-95"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 transition-transform duration-300 ease-out ${
          minimized ? "" : "rotate-180"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
  const importanceClass = {
    critical: "border-l-rose-500 bg-rose-950/25 text-rose-100",
    high: "border-l-orange-400 bg-orange-950/20 text-orange-100",
    medium: "border-l-sky-400 bg-sky-950/15 text-sky-100",
    low: "border-l-zinc-500 bg-zinc-900/40 text-zinc-100",
  }[task.importance];
  const importanceLabelClass = {
    critical: "text-rose-300",
    high: "text-orange-300",
    medium: "text-sky-300",
    low: "text-zinc-400",
  }[task.importance];
  const sourceLabel = task.is_personal
    ? "Personal task"
    : task.teams
      ? `${task.teams.name}${task.teams.team_number ? ` #${task.teams.team_number}` : ""}`
      : "Team task";

  return (
    <article
      id={`task-${task.id}`}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`min-w-0 ${minimized ? "p-3" : "space-y-3 p-3 md:p-4"} rounded-2xl backdrop-blur-xl border border-white/10 border-l-4 shadow-2xl shadow-black/50 ${importanceClass} hover:border-t-white/20 hover:border-r-white/20 hover:border-b-white/20 transition-all duration-300 ease-out ${
        onDragStart ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        isDragging ? "opacity-50" : ""
      } ${
        dueUrgency === "overdue"
          ? "ring-1 ring-rose-500/80"
          : dueUrgency === "today" || dueUrgency === "tomorrow"
            ? "ring-1 ring-amber-400/70"
            : ""
      }`}
    >
      {minimized ? (
        <div id={`task-body-${task.id}`} className="flex items-center gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h3 className="truncate text-xs font-semibold text-zinc-100">
              {task.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-zinc-500">
              <AssigneeAvatars assignees={task.task_assignees ?? []} />
              <span className={dueClass}>{dueText}</span>
            </div>
          </div>
          {toggleButton}
        </div>
      ) : (
      <div id={`task-body-${task.id}`} className="space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 space-y-1">
          <span
            className={`text-[9px] font-mono uppercase ${
              task.is_personal ? "text-zinc-500" : "text-emerald-300"
            }`}
          >
            {sourceLabel}
          </span>
          <h3 className="text-xs font-semibold text-zinc-100 leading-snug break-words">
            {task.name}
          </h3>
          {task.id.startsWith("temp-") ? (
            <span className="text-[9px] font-mono text-amber-400">Saving...</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className={`text-[10px] font-mono uppercase ${importanceLabelClass}`}>
            {task.importance}
          </span>
          {toggleButton}
        </div>
      </div>

      {task.description ? (
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-3">
          {task.description}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
        <span>Status: {task.status.replace("_", " ")}</span>
        {task.due_date ? <span className={dueClass}>{dueText}</span> : null}
      </div>

      {parentTask ? (
        <p className="text-[10px] font-mono text-zinc-400 break-words">
          Parent: <TaskLink task={parentTask} />
        </p>
      ) : null}

      {childTasks.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-mono uppercase text-zinc-500">
            Child tasks ({childTasks.length})
          </p>
          <ul className="space-y-1">
            {childTasks.map((child) => (
              <li key={child.id} className="text-xs">
                <TaskLink task={child} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {task.task_assignees && task.task_assignees.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.task_assignees.map((assignee) => (
            <span
              key={assignee.user_id}
              className="max-w-full truncate text-[10px] font-mono text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-lg border border-white/10"
            >
              {displayNameFromProfile(assignee.profiles)}
            </span>
          ))}
        </div>
      ) : null}

      {task.task_parts && task.task_parts.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {task.task_parts.map((taskPart) => (
            <span
              key={taskPart.part_id}
              className="max-w-full truncate text-[10px] font-mono text-emerald-300/80 bg-zinc-800/60 px-2 py-0.5 rounded-lg border border-white/10"
            >
              {taskPart.parts?.part_catalog?.name ?? "Part"}
              {taskPart.quantity ? ` × ${taskPart.quantity}` : ""}
            </span>
          ))}
        </div>
      ) : null}

      <FieldInput
        as="select"
        value={task.status}
        onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
        aria-label={`Move ${task.name} to status`}
      >
        {TASK_COLUMNS.map((column) => (
          <option key={column.id} value={column.id}>
            {column.label}
          </option>
        ))}
      </FieldInput>

      <div className="flex flex-wrap gap-2">
        {!task.id.startsWith("temp-") ? (
          <Link
            href={createSubtaskHref(task)}
            className={BTN_SECONDARY}
          >
            Create subtask
          </Link>
        ) : null}
        {onDelete && !task.id.startsWith("temp-") ? (
          <SecondaryButton type="button" onClick={onDelete}>
            Delete
          </SecondaryButton>
        ) : null}
      </div>
      </div>
      )}
    </article>
  );
}

function AssigneeAvatars({
  assignees,
}: {
  assignees: NonNullable<TaskWithRelations["task_assignees"]>;
}) {
  if (assignees.length === 0) {
    return <span>Unassigned</span>;
  }

  const shown = assignees.slice(0, 3);
  const extra = assignees.length - shown.length;
  const names = assignees
    .map((assignee) => displayNameFromProfile(assignee.profiles))
    .join(", ");

  return (
    <span className="inline-flex items-center" title={names} aria-label={`Assigned to ${names}`}>
      {shown.map((assignee, index) => {
        const name = displayNameFromProfile(assignee.profiles);
        const avatar = assignee.profiles?.avatar_image;
        return (
          <span
            key={assignee.user_id}
            className={`inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800/60 text-[10px] font-semibold uppercase text-zinc-300 ${
              index > 0 ? "-ml-1.5" : ""
            }`}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              name.charAt(0) || "?"
            )}
          </span>
        );
      })}
      {extra > 0 ? (
        <span className="ml-1.5 text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </span>
  );
}

function TaskLink({ task }: { task: TaskLink }) {
  return (
    <Link
      href={taskHref(task)}
      className="inline-flex min-h-11 max-w-full items-center break-words text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
    >
      {task.name}
    </Link>
  );
}

function taskHref(task: TaskLink) {
  const board = task.is_personal
    ? "/personal-tasks"
    : `/team-tasks?team=${encodeURIComponent(task.team_id ?? "")}`;
  return `${board}#task-${encodeURIComponent(task.id)}`;
}

function createSubtaskHref(task: TaskWithRelations) {
  const params = new URLSearchParams({ new: "1", parent: task.id });
  if (!task.is_personal && task.team_id) params.set("team", task.team_id);

  const board = task.is_personal ? "/personal-tasks" : "/team-tasks";
  return `${board}?${params.toString()}#task-form`;
}

function getDueUrgency(
  dueDate: string | null | undefined,
  status: TaskWithRelations["status"]
): "overdue" | "today" | "tomorrow" | null {
  if (!dueDate || status === "done") return null;

  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue === 0) return "today";
  if (daysUntilDue === 1) return "tomorrow";
  return null;
}