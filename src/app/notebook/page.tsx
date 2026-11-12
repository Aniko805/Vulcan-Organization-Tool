"use client";

import AppShell, {
  EmptyState,
  ErrorText,
  FieldInput,
  Label,
  Panel,
  PrimaryButton,
  SecondaryButton,
} from "@/app/components/AppShell";
import NotebookMarkdown from "@/app/components/NotebookMarkdown";
import { CARD, H_SCROLL } from "@/app/components/ui";
import {
  formatNoteTime,
  formatNotebookDate,
  localDateISO,
  shiftISODate,
  shortWeekday,
} from "@/lib/dates";
import { getNotebook, listNotebookRows, notebookTabs, updateSectionContent } from "@/lib/notebook";
import {
  MAX_NOTE_IMAGES,
  addNoteImage,
  attachSignedUrls,
  createNote,
  deleteNote,
  listNoteIndex,
  listNotes,
  signedImageUrls,
  updateNote,
} from "@/lib/notes";
import { supabase } from "@/lib/supabase";
import { listTeamTasks } from "@/lib/tasks";
import {
  listMyTeams,
  listTeamMembers,
  memberCanManageRoleDefinitions,
} from "@/lib/teams";
import {
  displayNameFromProfile,
  type EngNote,
  type Notebook,
  type TaskWithRelations,
  type Team,
  type TeamMember,
} from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Mode = "stream" | "document" | "timeline";

type TimelineDay = {
  date: string;
  noteCount: number;
  subteams: string[];
  status: string | null;
  snippet: string;
};
type Paper = "a4" | "letter";

const DEFAULT_SUBTEAMS = [
  "Mechanical",
  "Software",
  "CAD",
  "Electrical",
  "Business",
  "Outreach",
];
const UNTAGGED = "Untagged";

const PAPER: Record<Paper, string> = {
  a4: "max-w-[794px] md:min-h-[1123px]",
  letter: "max-w-[816px] md:min-h-[1056px]",
};

const HEADING_GRADIENT = "text-zinc-100";
const MONO_LABEL = "font-mono uppercase tracking-widest text-zinc-500";

function subteamOf(note: Pick<EngNote, "subteam">) {
  return note.subteam?.trim() || UNTAGGED;
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function buildTimeline(
  notes: Pick<EngNote, "note_date" | "subteam" | "body" | "title">[],
  books: { notebook_date: string; status: string; title: string | null }[]
): TimelineDay[] {
  const days = new Map<string, TimelineDay>();
  for (const note of notes) {
    const current = days.get(note.note_date) ?? {
      date: note.note_date,
      noteCount: 0,
      subteams: [],
      status: null,
      snippet: "",
    };
    current.noteCount += 1;
    if (note.subteam && !current.subteams.includes(note.subteam)) {
      current.subteams.push(note.subteam);
    }
    if (!current.snippet) {
      current.snippet = (note.title || note.body || "").replace(/\s+/g, " ").slice(0, 140);
    }
    days.set(note.note_date, current);
  }
  for (const book of books) {
    const current = days.get(book.notebook_date) ?? {
      date: book.notebook_date,
      noteCount: 0,
      subteams: [],
      status: null,
      snippet: book.title ?? "",
    };
    current.status = book.status;
    days.set(book.notebook_date, current);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export default function NotebookPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [date, setDate] = useState(() => localDateISO());
  const [notes, setNotes] = useState<EngNote[]>([]);
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("stream");
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [filter, setFilter] = useState("all");
  const [paper, setPaper] = useState<Paper>("a4");
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subteam, setSubteam] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState("");

  const loadGeneration = useRef(0);

  const team = teams.find((item) => item.id === teamId) ?? null;
  const membership = members.find((member) => member.user_id === userId) ?? null;
  const isAdmin = Boolean(
    team && userId && memberCanManageRoleDefinitions(team, userId, membership)
  );

  const loadDay = useCallback(async (tid: string, day: string) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const [rawNotes, book, taskList] = await Promise.all([
        listNotes({ teamId: tid, date: day }),
        getNotebook(tid, day),
        listTeamTasks(tid).catch(() => [] as TaskWithRelations[]),
      ]);
      const urls = await signedImageUrls(
        rawNotes.flatMap((note) =>
          (note.eng_note_images ?? []).map((image) => image.storage_path)
        )
      ).catch(() => ({}) as Record<string, string>);
      if (generation !== loadGeneration.current) return;
      setNotes(attachSignedUrls(rawNotes, urls));
      setNotebook(book);
      setTasks(taskList);
    } catch (e) {
      if (generation !== loadGeneration.current) return;
      setError(e instanceof Error ? e.message : "Failed to load the notebook");
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      setUserId(user.id);
      try {
        const myTeams = await listMyTeams();
        if (!mounted) return;
        setTeams(myTeams);
        setTeamId(myTeams[0]?.id ?? null);
        if (myTeams.length === 0) setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load teams");
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!teamId) return;
    const run = async () => {
      await loadDay(teamId, date);
    };
    void run();
  }, [teamId, date, loadDay]);

  const loadTimeline = useCallback(async (tid: string) => {
    setTimelineLoading(true);
    try {
      const [index, books] = await Promise.all([
        listNoteIndex(tid),
        listNotebookRows(tid),
      ]);
      setTimeline(buildTimeline(index, books));
    } catch (e) {
      setTimeline([]);
      setError(e instanceof Error ? e.message : "Failed to load the timeline");
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!teamId) return;
    void loadTimeline(teamId);
  }, [teamId, loadTimeline]);

  useEffect(() => {
    if (!teamId) return;
    let mounted = true;
    listTeamMembers(teamId)
      .then((rows) => {
        if (mounted) setMembers(rows);
      })
      .catch(() => {
        if (mounted) setMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, [teamId]);

  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews]
  );

  const subteamOptions = useMemo(() => {
    const found = notes.map(subteamOf).filter((name) => name !== UNTAGGED);
    const all = [...DEFAULT_SUBTEAMS];
    for (const name of found) {
      if (!all.some((existing) => sameName(existing, name))) all.push(name);
    }
    return all;
  }, [notes]);

  const visibleNotes = useMemo(
    () =>
      notes.filter((note) => filter === "all" || sameName(subteamOf(note), filter)),
    [notes, filter]
  );

  const notesById = useMemo(
    () => new Map(notes.map((note) => [note.id, note])),
    [notes]
  );
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );
  const imagesById = useMemo(() => {
    const map = new Map<string, { url: string | null; caption: string | null }>();
    for (const note of notes) {
      for (const image of note.eng_note_images ?? []) {
        map.set(image.id, { url: image.signed_url ?? null, caption: image.caption });
      }
    }
    return map;
  }, [notes]);

  const curatedTabs = useMemo(() => {
    if (notebook?.status !== "curated") return [];
    const tabs = notebookTabs(notebook.notebook_sections ?? []);
    return tabs.filter((tab) => filter === "all" || sameName(tab.name, filter));
  }, [notebook, filter]);
  const useCurated = notebook?.status === "curated" && curatedTabs.length > 0;

  const groupedNotes = useMemo(() => {
    const groups = new Map<string, EngNote[]>();
    const ordered = [...visibleNotes].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    );
    for (const note of ordered) {
      const key = subteamOf(note);
      groups.set(key, [...(groups.get(key) ?? []), note]);
    }
    return [...groups.entries()];
  }, [visibleNotes]);

  const postNote = async () => {
    if (!teamId || !userId || !body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const created = await createNote({
        teamId,
        authorId: userId,
        noteDate: date,
        title,
        body: body.trim(),
        subteam: subteam || null,
      });
      for (const [index, file] of files.entries()) {
        await addNoteImage({
          noteId: created.id,
          teamId,
          createdBy: userId,
          file,
          position: index,
        });
      }
      setTitle("");
      setBody("");
      setFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the log");
    } finally {
      await Promise.all([loadDay(teamId, date), loadTimeline(teamId)]);
      setPosting(false);
    }
  };

  const saveNote = async (note: EngNote) => {
    if (!teamId) return;
    try {
      await updateNote(note.id, { title: editTitle, body: editBody });
      setEditingNoteId(null);
      await Promise.all([loadDay(teamId, date), loadTimeline(teamId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the log");
    }
  };

  const removeNote = async (note: EngNote) => {
    if (!teamId || !window.confirm("Delete this log and its photos?")) return;
    try {
      await deleteNote(note);
      await Promise.all([loadDay(teamId, date), loadTimeline(teamId)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the log");
    }
  };

  const saveSection = async (sectionId: string) => {
    if (!teamId || !userId) return;
    try {
      await updateSectionContent({
        sectionId,
        content: sectionDraft,
        editorId: userId,
      });
      setEditingSectionId(null);
      await loadDay(teamId, date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the section");
    }
  };

  const pills = ["all", ...subteamOptions];
  const countFor = (name: string) =>
    name === "all"
      ? notes.length
      : notes.filter((note) => sameName(subteamOf(note), name)).length;

  return (
    <AppShell
      eyebrow="Documentation"
      title="Engineering Notebook"
      actions={
        <FieldInput
          as="select"
          aria-label="Team"
          className="w-48"
          value={teamId ?? ""}
          onChange={(event) => {
            const next = event.target.value || null;
            setNotes([]);
            setNotebook(null);
            setTimeline([]);
            setFilter("all");
            setLoading(Boolean(next));
            setTeamId(next);
          }}
        >
          {teams.length === 0 ? <option value="">No teams</option> : null}
          {teams.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </FieldInput>
      }
    >
      <div
        role="status"
        className="no-print w-full rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-center font-mono text-xs font-semibold uppercase tracking-widest text-amber-200 backdrop-blur-xl"
      >
        Coming soon
      </div>

      <ErrorText>{error}</ErrorText>

      {!teamId ? (
        <Panel>
          <EmptyState>
            {loading ? "Loading…" : "Join a team to keep an engineering notebook."}
          </EmptyState>
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* Row 1: view mode */}
          <Panel className="no-print !p-2">
              <div
                role="tablist"
                aria-label="View mode"
                className="flex w-full gap-1"
              >
                {(
                  [
                    ["stream", "Log Stream"],
                    ["timeline", "Timeline"],
                    ["document", "Compiled Document"],
                  ] as [Mode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => setMode(value)}
                    className={`min-h-11 flex-1 rounded-xl border px-2 font-mono text-[10px] uppercase tracking-widest transition-all duration-300 ease-out sm:px-4 sm:text-xs ${
                      mode === value
                        ? "border-emerald-400/40 bg-emerald-500/10 text-zinc-100 ring-1 ring-emerald-400/30"
                        : "border-transparent text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
          </Panel>

          {/* Row 2: date navigation, one line */}
          {mode === "timeline" ? null : (
          <Panel className="no-print !p-3">
            <div
              role="group"
              aria-label="Date navigation"
              className="flex items-center gap-2"
            >
              <SecondaryButton
                type="button"
                aria-label="Previous day"
                className="shrink-0 px-3"
                onClick={() => setDate(shiftISODate(date, -1))}
              >
                <span aria-hidden="true">‹</span>
                <span className="hidden sm:inline">Prev</span>
              </SecondaryButton>
              <FieldInput
                type="date"
                aria-label="Notebook date"
                className="min-w-0 flex-1 text-center font-mono"
                value={date}
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value);
                }}
              />
              <SecondaryButton
                type="button"
                aria-label="Next day"
                className="shrink-0 px-3"
                onClick={() => setDate(shiftISODate(date, 1))}
              >
                <span className="hidden sm:inline">Next</span>
                <span aria-hidden="true">›</span>
              </SecondaryButton>
              <SecondaryButton
                type="button"
                className="shrink-0 px-3 sm:px-4"
                onClick={() => setDate(localDateISO())}
              >
                Today
              </SecondaryButton>
            </div>
          </Panel>
          )}

          {/* Row 3: subteam filter */}
          {mode === "timeline" ? null : (
          <Panel className="no-print !p-3">
            <div
              role="group"
              aria-label="Filter by subteam"
              className={`flex gap-2 px-4 ${H_SCROLL}`}
            >
              {pills.map((name) => {
                const active = sameName(filter, name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(name)}
                    className={`min-h-11 shrink-0 rounded-xl border px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all duration-300 ease-out ${
                      active
                        ? "border-emerald-400/40 bg-emerald-500/10 text-zinc-100 ring-1 ring-emerald-400/30"
                        : "border-white/10 bg-zinc-900/45 text-zinc-500 hover:border-white/20 hover:bg-zinc-800/50 hover:text-zinc-300"
                    }`}
                  >
                    {name === "all" ? "All" : name} ({countFor(name)})
                  </button>
                );
              })}
            </div>
          </Panel>
          )}

          {mode === "timeline" ? (
            <div className="mx-auto w-full max-w-2xl">
              {timelineLoading ? (
                <Panel>
                  <EmptyState>Loading timeline…</EmptyState>
                </Panel>
              ) : timeline.length === 0 ? (
                <Panel>
                  <EmptyState>No logs yet. Post one from the Log Stream.</EmptyState>
                </Panel>
              ) : (
                <ol className="relative ml-3 border-l border-emerald-400/30 pl-8">
                  {timeline.map((day, index) => {
                    const curated = day.status === "curated";
                    const isLast = index === timeline.length - 1;
                    return (
                      <li key={day.date} className={isLast ? "relative" : "relative pb-8"}>
                        <span
                          aria-hidden="true"
                          className={`absolute -left-[2.4rem] top-3 h-3 w-3 rounded-full ring-4 ring-zinc-950 ${
                            curated
                              ? "bg-emerald-400 shadow-lg shadow-emerald-500/30"
                              : "border border-zinc-500 bg-zinc-900"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDate(day.date);
                            setMode("document");
                          }}
                          className={`${CARD} block w-full space-y-2 p-4 text-left transition-all duration-300 ease-out hover:border-white/20 hover:bg-zinc-800/50`}
                        >
                          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span className="text-sm font-semibold tracking-tight text-zinc-100">
                              {formatNotebookDate(day.date)}
                            </span>
                            <span className={`text-[10px] ${MONO_LABEL}`}>
                              {shortWeekday(day.date)}
                            </span>
                          </span>
                          <span className={`block text-[10px] ${MONO_LABEL}`}>
                            {day.noteCount} {day.noteCount === 1 ? "log" : "logs"}
                            {curated ? " · curated" : ""}
                            {day.subteams.length > 0 ? ` · ${day.subteams.join(" · ")}` : ""}
                          </span>
                          {day.snippet ? (
                            <span className="block text-sm leading-relaxed text-zinc-400">
                              {day.snippet}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ) : mode === "stream" ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
              {/* Logging form */}
              <Panel className="space-y-3 lg:sticky lg:top-6">
                <Label>New log · {formatNotebookDate(date)}</Label>
                <FieldInput
                  placeholder="Title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <FieldInput
                  as="select"
                  aria-label="Subteam"
                  value={subteam}
                  onChange={(event) => setSubteam(event.target.value)}
                >
                  <option value="">{UNTAGGED}</option>
                  {subteamOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </FieldInput>
                <FieldInput
                  as="textarea"
                  placeholder="What happened? Describe the work, results and next steps."
                  rows={6}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />

                {previews.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {previews.map((url, index) => (
                      <li key={url} className="relative">
                        {/* Local object URL preview, not a configured image host. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Attachment ${index + 1}`}
                          className="h-16 w-16 rounded-xl border border-white/10 object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remove attachment ${index + 1}`}
                          onClick={() =>
                            setFiles((current) => current.filter((_, i) => i !== index))
                          }
                          className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-xs text-zinc-200 hover:bg-zinc-700"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-800/60 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-200 transition-all hover:bg-zinc-700/60 active:scale-95">
                    Attach photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        const picked = [...(event.target.files ?? [])];
                        event.target.value = "";
                        setFiles((current) =>
                          [...current, ...picked].slice(0, MAX_NOTE_IMAGES)
                        );
                      }}
                    />
                  </label>
                  <span className={`text-[10px] ${MONO_LABEL}`}>
                    {files.length}/{MAX_NOTE_IMAGES}
                  </span>
                  <PrimaryButton
                    type="button"
                    className="ml-auto"
                    disabled={posting || !body.trim()}
                    onClick={() => void postNote()}
                  >
                    {posting ? "Posting…" : "Post log"}
                  </PrimaryButton>
                </div>
              </Panel>

              {/* Feed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 px-1">
                  <Label>
                    {formatNotebookDate(date)} · {visibleNotes.length}{" "}
                    {visibleNotes.length === 1 ? "log" : "logs"}
                  </Label>
                </div>

                {loading ? (
                  <Panel>
                    <EmptyState>Loading logs…</EmptyState>
                  </Panel>
                ) : visibleNotes.length === 0 ? (
                  <Panel>
                    <EmptyState>
                      {filter === "all"
                        ? "No logs for this date yet."
                        : `No ${filter} logs for this date.`}
                    </EmptyState>
                  </Panel>
                ) : (
                  visibleNotes.map((note) => {
                    const canEdit = note.author_id === userId || isAdmin;
                    const editing = editingNoteId === note.id;
                    return (
                      <article
                        key={note.id}
                        className={`${CARD} space-y-3 p-4 transition-all duration-300 ease-out hover:border-white/20 hover:bg-zinc-800/50`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-[10px] ${MONO_LABEL}`}>
                            {formatNoteTime(note.created_at)} ·{" "}
                            {displayNameFromProfile(note.author)}
                          </p>
                          <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                            {subteamOf(note)}
                          </span>
                        </div>

                        {editing ? (
                          <div className="space-y-2">
                            <FieldInput
                              aria-label="Log title"
                              value={editTitle}
                              onChange={(event) => setEditTitle(event.target.value)}
                            />
                            <FieldInput
                              as="textarea"
                              aria-label="Log description"
                              rows={5}
                              value={editBody}
                              onChange={(event) => setEditBody(event.target.value)}
                            />
                            <div className="flex gap-2">
                              <PrimaryButton
                                type="button"
                                disabled={!editBody.trim()}
                                onClick={() => void saveNote(note)}
                              >
                                Save
                              </PrimaryButton>
                              <SecondaryButton
                                type="button"
                                onClick={() => setEditingNoteId(null)}
                              >
                                Cancel
                              </SecondaryButton>
                            </div>
                          </div>
                        ) : (
                          <>
                            {note.title ? (
                              <h3 className="text-sm font-semibold tracking-tight text-zinc-100">
                                {note.title}
                              </h3>
                            ) : null}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-400">
                              {note.body}
                            </p>
                          </>
                        )}

                        {(note.eng_note_images ?? []).some((image) => image.signed_url) ? (
                          <div className="flex flex-wrap gap-2">
                            {(note.eng_note_images ?? []).map((image) =>
                              image.signed_url ? (
                                <a
                                  key={image.id}
                                  href={image.signed_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={image.signed_url}
                                    alt={image.caption || "Log photo"}
                                    className="h-20 w-20 rounded-xl border border-white/10 object-cover"
                                  />
                                </a>
                              ) : null
                            )}
                          </div>
                        ) : null}

                        {canEdit && !editing ? (
                          <div className="flex flex-wrap gap-2">
                            <SecondaryButton
                              type="button"
                              onClick={() => {
                                setEditingNoteId(note.id);
                                setEditTitle(note.title ?? "");
                                setEditBody(note.body);
                              }}
                            >
                              Edit
                            </SecondaryButton>
                            <SecondaryButton
                              type="button"
                              onClick={() => void removeNote(note)}
                            >
                              Delete
                            </SecondaryButton>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Document toolbar */}
              <Panel className="no-print flex flex-wrap items-center gap-3 !p-4">
                <div
                  role="group"
                  aria-label="Paper size"
                  className="flex gap-1 rounded-2xl border border-white/10 bg-zinc-900/45 p-1"
                >
                  {(["a4", "letter"] as Paper[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={paper === size}
                      onClick={() => setPaper(size)}
                      className={`min-h-11 rounded-xl border px-4 font-mono text-[10px] uppercase tracking-widest transition-all duration-300 ease-out ${
                        paper === size
                          ? "border-white/10 bg-zinc-800/60 text-zinc-100"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {size === "a4" ? "A4" : "Letter"}
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex flex-wrap gap-2">
                  <SecondaryButton
                    type="button"
                    onClick={() => {
                      setPdfNotice(null);
                      window.setTimeout(() => window.print(), 50);
                    }}
                  >
                    Download PDF · This day
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() =>
                      setPdfNotice(
                        "Full-season PDF export is not available yet."
                      )
                    }
                  >
                    Download PDF · Full season
                  </SecondaryButton>
                </div>
                {pdfNotice ? (
                  <p
                    role="status"
                    className="basis-full font-mono text-[10px] uppercase tracking-widest text-amber-300"
                  >
                    {pdfNotice}
                  </p>
                ) : null}
              </Panel>

              {/* Portrait page */}
              <div
                className={`print-sheet relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/45 shadow-2xl shadow-black/50 ring-1 ring-emerald-400/20 backdrop-blur-xl ${PAPER[paper]}`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-6 w-px bg-emerald-400/30 md:left-12"
                />
                <div className="relative space-y-8 px-6 pb-12 pt-8 pl-10 md:pl-20 md:pr-12">
                  <header className="space-y-2 border-b border-white/10 pb-5">
                    <p className={`text-[10px] ${MONO_LABEL}`}>
                      {team?.name}
                      {team?.team_number ? ` · #${team.team_number}` : ""}
                    </p>
                    <h2
                      className={`text-3xl font-extrabold tracking-tight ${HEADING_GRADIENT}`}
                    >
                      Engineering Notebook
                    </h2>
                    <p className="font-mono text-sm text-zinc-400">
                      {formatNotebookDate(date)}
                    </p>
                    <p className={`text-[10px] ${MONO_LABEL}`}>
                      {useCurated
                        ? "Curated notebook"
                        : `Compiled from ${visibleNotes.length} ${
                            visibleNotes.length === 1 ? "log" : "logs"
                          }`}
                      {filter !== "all" ? ` · ${filter}` : ""}
                    </p>
                  </header>

                  {loading ? (
                    <EmptyState>Compiling…</EmptyState>
                  ) : useCurated ? (
                    curatedTabs.map((tab) => (
                      <section key={tab.name} className="space-y-4">
                        <h3 className="border-b border-white/10 pb-1 font-mono text-xs uppercase tracking-widest text-emerald-300">
                          {tab.name}
                        </h3>
                        {tab.sections.map((section) => (
                          <div key={section.id} className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
                                {section.section_name}
                              </h4>
                              {editingSectionId !== section.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSectionId(section.id);
                                    setSectionDraft(section.content);
                                  }}
                                  className="no-print inline-flex min-h-11 items-center rounded-xl px-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500 transition-all hover:bg-zinc-800/50 hover:text-zinc-100"
                                >
                                  Edit
                                </button>
                              ) : null}
                            </div>
                            {editingSectionId === section.id ? (
                              <div className="no-print space-y-2">
                                <FieldInput
                                  as="textarea"
                                  aria-label={`Edit ${section.section_name}`}
                                  rows={8}
                                  value={sectionDraft}
                                  onChange={(event) => setSectionDraft(event.target.value)}
                                />
                                <div className="flex gap-2">
                                  <PrimaryButton
                                    type="button"
                                    onClick={() => void saveSection(section.id)}
                                  >
                                    Save section
                                  </PrimaryButton>
                                  <SecondaryButton
                                    type="button"
                                    onClick={() => setEditingSectionId(null)}
                                  >
                                    Cancel
                                  </SecondaryButton>
                                </div>
                              </div>
                            ) : section.content ? (
                              <NotebookMarkdown
                                content={section.content}
                                notesById={notesById}
                                tasksById={tasksById}
                                imagesById={imagesById}
                              />
                            ) : (
                              <p className="text-sm text-zinc-500">
                                Nothing written in this section yet.
                              </p>
                            )}
                          </div>
                        ))}
                      </section>
                    ))
                  ) : groupedNotes.length === 0 ? (
                    <p className="text-sm text-zinc-500">
                      No logs for this date. Post one from the Log Stream.
                    </p>
                  ) : (
                    groupedNotes.map(([name, entries]) => (
                      <section key={name} className="space-y-4">
                        <h3 className="border-b border-white/10 pb-1 font-mono text-xs uppercase tracking-widest text-emerald-300">
                          {name}
                        </h3>
                        {entries.map((note) => (
                          <div key={note.id} className="space-y-2">
                            <p className={`text-[10px] ${MONO_LABEL}`}>
                              {formatNoteTime(note.created_at)} ·{" "}
                              {displayNameFromProfile(note.author)}
                            </p>
                            {note.title ? (
                              <h4 className="text-base font-semibold tracking-tight text-zinc-100">
                                {note.title}
                              </h4>
                            ) : null}
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
                              {note.body}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {(note.eng_note_images ?? []).map((image) =>
                                image.signed_url ? (
                                  <figure key={image.id}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={image.signed_url}
                                      alt={image.caption || "Log photo"}
                                      className="max-h-48 rounded-xl border border-white/10"
                                    />
                                    {image.caption ? (
                                      <figcaption className={`mt-1 text-[10px] ${MONO_LABEL}`}>
                                        {image.caption}
                                      </figcaption>
                                    ) : null}
                                  </figure>
                                ) : null
                              )}
                            </div>
                          </div>
                        ))}
                      </section>
                    ))
                  )}

                  {!loading && !useCurated && notes.length > 0 ? (
                    <p className="no-print font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      No curated notebook for this date yet.
                    </p>
                  ) : null}

                  <footer className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    <span>Vulcan engineering notebook</span>
                    <span>{date} · Page 1</span>
                  </footer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
