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
import CatalogPicker from "@/app/components/CatalogPicker";
import {
  CARD_INTERACTIVE,
  H_SCROLL,
  INPUT,
  SCROLLBAR,
} from "@/app/components/ui";
import {
  addPartToInventory,
  deletePart,
  deletePartStatusListing,
  listPartStatuses,
  listParts,
  updatePartDescription,
  updatePartQuantity,
  updatePartStatus,
} from "@/lib/parts";
import { supabase } from "@/lib/supabase";
import {
  listMyTeams,
  listTeamMembers,
  memberCanManageInventory,
} from "@/lib/teams";
import {
  type Part,
  type PartCatalog,
  type PartStatus,
  type StatusList,
  type Team,
  type TeamMember,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const QTY_STEP =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/10 text-sm font-bold text-zinc-200 transition-all active:scale-95";

export default function PartsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [statuses, setStatuses] = useState<StatusList[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<PartCatalog | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEpoch, setDrawerEpoch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const refreshGeneration = useRef(0);

  const selectedTeam = teams.find((t) => t.id === teamId) ?? null;
  const myMembership = members.find((m) => m.user_id === userId) ?? null;
  const canManage =
    selectedTeam && userId
      ? memberCanManageInventory(selectedTeam, userId, myMembership)
      : false;
  const hasValidCatalogSelection = Boolean(selectedCatalog) || Boolean(name.trim());

  const refresh = useCallback(async (tid: string) => {
    const generation = ++refreshGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const [p, m, s] = await Promise.all([
        listParts(tid),
        listTeamMembers(tid),
        listPartStatuses(tid),
      ]);
      if (generation !== refreshGeneration.current) return;
      setParts(p);
      setMembers(m);
      setStatuses(s);
      setSelectedStatusId((current) => {
        if (s.some((status) => status.id === current)) return current;
        return (
          s.find((status) => status.name === "PLANNING")?.id ??
          s.find((status) => status.is_default)?.id ??
          s[0]?.id ??
          ""
        );
      });
    } catch (e) {
      if (generation !== refreshGeneration.current) return;
      setParts([]);
      setMembers([]);
      setStatuses([]);
      setSelectedStatusId("");
      setError(e instanceof Error ? e.message : "Failed to load parts");
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, []);

  const commitQuantity = async (partStatusId: string, raw: string) => {
    const parsed = Math.max(0, parseInt(raw, 10) || 0);
    try {
      await updatePartQuantity(partStatusId, parsed);
      if (teamId) await refresh(teamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quantity");
    }
  };

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load teams");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!teamId) return;
    const loadData = async () => {
      await refresh(teamId);
    };
    loadData();
  }, [teamId, refresh]);

  const listings = parts.flatMap<{ part: Part; statusRecord: PartStatus | null }>((part) => {
    const partStatuses = part.part_status ?? [];
    return partStatuses.length > 0
      ? partStatuses.map((statusRecord) => ({ part, statusRecord }))
      : [{ part, statusRecord: null }];
  });
  const searchQuery = search.trim().toLowerCase();
  const searched = searchQuery
    ? listings.filter(({ part }) => {
        const name = part.part_catalog?.name ?? "";
        const sku = part.part_catalog?.sku ?? "";
        return (
          name.toLowerCase().includes(searchQuery) ||
          sku.toLowerCase().includes(searchQuery)
        );
      })
    : listings;
  const visible =
    filter === "all"
      ? searched
      : searched.filter(
          ({ statusRecord }) =>
            statusRecord?.status_id === filter ||
            statusRecord?.status_list?.id === filter ||
            statusRecord?.status_list?.name === filter
        );

  // The drawer keeps showing the last selected part while it slides out, so
  // content only disappears once the part is gone from the list.
  const activeListing = (() => {
    if (!selectedKey) return null;
    const match = listings.find(
      ({ part, statusRecord }) =>
        `${part.id}-${statusRecord?.id ?? "no-status"}` === selectedKey
    );
    if (!match) return null;
    const status =
      statuses.find((item) => item.id === match.statusRecord?.status_id) ??
      match.statusRecord?.status_list;
    return {
      key: selectedKey,
      part: match.part,
      statusName: status?.name ?? "Unknown",
      quantity: match.statusRecord?.quantity ?? 1,
    };
  })();
  const drawerShown = drawerOpen && activeListing !== null;

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setDrawerEpoch((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  // #region agent log
  useEffect(() => {
    const banner = document.getElementById("diag-parts-banner");
    const rect = banner?.getBoundingClientRect();
    fetch('http://127.0.0.1:7787/ingest/11f8c054-3fd0-4031-b844-76703809d39a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'da45ad'},body:JSON.stringify({sessionId:'da45ad',runId:'run1',hypothesisId:'A,B,C,D',location:'parts/page.tsx:mount',message:'parts page mounted in browser',data:{href:window.location.href,buildSha:process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA??null,vercelEnv:process.env.NEXT_PUBLIC_VERCEL_ENV??null,bannerInDom:Boolean(banner),bannerHeight:rect?.height??null,bannerDisplay:banner?getComputedStyle(banner).display:null,drawerInDom:Boolean(document.querySelector('aside[aria-label="Part details"]')),swControlled:Boolean(navigator.serviceWorker?.controller)},timestamp:Date.now()})}).catch(()=>{});
  }, []);
  // #endregion

  const handleCreate = async () => {
    if (!userId || !teamId || !hasValidCatalogSelection || !selectedStatusId) return;
    setBusy(true);
    setError(null);
    try {
      await addPartToInventory({
        teamId,
        catalogId: selectedCatalog?.id ?? null,
        name: selectedCatalog?.name ?? name.trim(),
        sku: selectedCatalog?.sku ?? sku.trim(),
        description: selectedCatalog?.description ?? notes.trim(),
        statusId: selectedStatusId,
        quantity,
      });

      setSelectedCatalog(null);
      setName("");
      setSku("");
      setNotes("");
      setQuantity(1);
      await refresh(teamId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    
    <AppShell
      eyebrow="Inventory"
      title="Parts"
      actions={
        <FieldInput
          as="select"
          className="w-48"
          value={teamId ?? ""}
          onChange={(e) => {
            const nextTeamId = e.target.value || null;
            refreshGeneration.current += 1;
            setFilter("all");
            setSearch("");
            setSelectedKey(null);
            setDrawerOpen(false);
            setParts([]);
            setMembers([]);
            setStatuses([]);
            setSelectedCatalog(null);
            setSelectedStatusId("");
            setError(null);
            setLoading(Boolean(nextTeamId));
            setTeamId(nextTeamId);
          }}
        >
          {teams.length === 0 ? <option value="">No teams</option> : null}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </FieldInput>
      }
    >
      <ErrorText>{error}</ErrorText>

      {!teamId ? (
        <Panel>
          <EmptyState>Join a team to manage inventory.</EmptyState>
        </Panel>
      ) : (
        <>
          {canManage ? (
            <Panel className="relative z-20 space-y-3">
              <Label>Add part</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <CatalogPicker
                  key={teamId}
                  teamId={teamId}
                  value={selectedCatalog}
                  onChange={setSelectedCatalog}
                />
                <FieldInput
                  as="select"
                  aria-label="Initial part status"
                  value={selectedStatusId}
                  disabled={statuses.length === 0}
                  onChange={(e) => setSelectedStatusId(e.target.value)}
                >
                  {statuses.length === 0 ? (
                    <option value="">No statuses available</option>
                  ) : null}
                  {statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </FieldInput>
                <FieldInput
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                />
                {!selectedCatalog ? (
                  <>
                    <FieldInput
                      placeholder="Part name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <FieldInput
                      placeholder="SKU / type"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                    />
                    <FieldInput
                      placeholder="Description"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </>
                ) : (
                  <p className="md:col-span-4 text-xs text-zinc-500">
                    {selectedCatalog?.description || "No description"}
                  </p>
                )}
              </div>
              <PrimaryButton
                disabled={
                  busy ||
                  !hasValidCatalogSelection ||
                  !selectedStatusId ||
                  statuses.length === 0
                }
                onClick={handleCreate}
              >
                Add to inventory
              </PrimaryButton>
            </Panel>
          ) : (
            <Panel>
              <EmptyState>You can view inventory; ask an admin for edit access.</EmptyState>
            </Panel>
          )}

          <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center">
            <FieldInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or SKU"
              aria-label="Search inventory by name or SKU"
              className="sm:max-w-xs"
            />
            <div className={`flex min-w-0 flex-1 gap-2 ${H_SCROLL}`}>
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label={`All (${searched.length})`}
            />
            {statuses.map((status) => {
              const count = searched.filter(
                ({ statusRecord }) =>
                  statusRecord?.status_id === status.id ||
                  statusRecord?.status_list?.id === status.id ||
                  statusRecord?.status_list?.name === status.name
              ).length;

              return (
                <FilterChip
                  key={status.id}
                  active={filter === status.id}
                  onClick={() => setFilter(status.id)}
                  label={`${status.name} (${count})`}
                />
              );
            })}
            </div>
          </div>

          {!loading && statuses.length === 0 ? (
            <Panel>
              <EmptyState>
                No inventory statuses are available. Confirm that global default
                statuses exist and apply the inventory access migration.
              </EmptyState>
            </Panel>
          ) : null}

          {/* Master list + details drawer. On xl the drawer opens inline and
              the list narrows; below xl it slides over the page. */}
          <div className="flex items-start">
          <div className="min-w-0 flex-1 space-y-2 transition-all duration-300 ease-out">
            {loading ? (
              <Panel>
                <EmptyState>Loading parts…</EmptyState>
              </Panel>
            ) : visible.length === 0 ? (
              <Panel>
                <EmptyState>
                  {searchQuery
                    ? "No listings match that name or SKU."
                    : "No parts in this filter."}
                </EmptyState>
              </Panel>
            ) : (
              visible.map(({ part, statusRecord }) => {
                const catalog = part.part_catalog;
                const currentQty = statusRecord?.quantity ?? 1;
                const currentStatus =
                  statuses.find((status) => status.id === statusRecord?.status_id) ??
                  statusRecord?.status_list;
                const currentStatusId =
                  currentStatus?.id ?? "";
                const currentStatusName = currentStatus?.name ?? "Unknown";
                const listingKey = `${part.id}-${statusRecord?.id ?? "no-status"}`;
                const isActive = drawerOpen && selectedKey === listingKey;

                return (
                  <div
                    key={listingKey}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("[data-no-select]")) return;
                      setSelectedKey(listingKey);
                      setDrawerOpen(true);
                    }}
                    className={`${CARD_INTERACTIVE} cursor-pointer p-4 flex flex-wrap items-center justify-between gap-4 ${
                      isActive ? "ring-1 ring-emerald-400/50 bg-zinc-800/50" : ""
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`View details for ${catalog?.name ?? "part"}`}
                      className="min-h-11 min-w-0 flex-1 basis-48 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                    >
                      <span className="block truncate text-sm font-semibold text-zinc-100">
                        {catalog?.name ?? "Unnamed Part"}
                      </span>
                      <span className="mt-1 block truncate text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                        {catalog?.sku ? `SKU ${catalog.sku}` : "No SKU"}
                      </span>
                    </button>

                    <div data-no-select className="flex items-center gap-3 cursor-default">
                      {canManage && statusRecord && statuses.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newQty = Math.max(0, currentQty - 1);
                              setParts((prev) =>
                                prev.map((p) =>
                                  p.id === part.id && p.part_status?.[0]
                                    ? {
                                        ...p,
                                        part_status: p.part_status?.map((status) =>
                                          status.id === statusRecord.id
                                            ? { ...status, quantity: newQty }
                                            : status
                                        ),
                                      }
                                    : p
                                )
                              );
                              commitQuantity(statusRecord.id, String(newQty));
                            }}
                            className={QTY_STEP}
                          >
                            −
                          </button>

                          <input
                            type="number"
                            min="0"
                            value={currentQty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              const next = isNaN(val) ? 0 : Math.max(0, val);
                              setParts((prev) =>
                                prev.map((p) =>
                                  p.id === part.id && p.part_status?.[0]
                                    ? {
                                        ...p,
                                        part_status: p.part_status?.map((status) =>
                                          status.id === statusRecord.id
                                            ? { ...status, quantity: next }
                                            : status
                                        ),
                                      }
                                    : p
                                )
                              );
                            }}
                            onBlur={(e) => commitQuantity(statusRecord.id, e.target.value)}
                            className={`${INPUT} !w-16 px-1 text-center font-mono`}
                          />

                          <button
                            type="button"
                            onClick={() => {
                              const newQty = currentQty + 1;
                              setParts((prev) =>
                                prev.map((p) =>
                                  p.id === part.id && p.part_status?.[0]
                                    ? {
                                        ...p,
                                        part_status: p.part_status?.map((status) =>
                                          status.id === statusRecord.id
                                            ? { ...status, quantity: newQty }
                                            : status
                                        ),
                                      }
                                    : p
                                )
                              );
                              commitQuantity(statusRecord.id, String(newQty));
                            }}
                            className={QTY_STEP}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-mono text-zinc-400">
                          Qty: {currentQty}
                        </span>
                      )}

                      {canManage && statusRecord && statuses.length > 0 ? (
                        <FieldInput
                          as="select"
                          className="w-40"
                          value={currentStatusId}
                          onChange={async (e) => {
                            try {
                              await updatePartStatus(statusRecord.id, e.target.value);
                              if (teamId) await refresh(teamId);
                            } catch (err) {
                              setError(
                                err instanceof Error ? err.message : "Status update failed"
                              );
                            }
                          }}
                        >
                          {statuses.map((status) => (
                            <option key={status.id} value={status.id}>
                              {status.name}
                            </option>
                          ))}
                        </FieldInput>
                      ) : (
                        <span className="text-[10px] font-mono uppercase text-zinc-500">
                          {currentStatusName}
                        </span>
                      )}

                      {canManage ? (
                        <SecondaryButton
                          onClick={async () => {
                            if (
                              !window.confirm(
                                statusRecord
                                  ? `Delete the ${currentStatusName} listing for "${catalog?.name ?? "this part"}"? Other status listings will remain.`
                                  : `Delete "${catalog?.name ?? "this part"}"? This cannot be undone.`
                              )
                            )
                              return;
                            try {
                              if (statusRecord) {
                                await deletePartStatusListing(statusRecord.id);
                              } else {
                                await deletePart(part.id);
                              }
                              if (teamId) await refresh(teamId);
                            } catch (err) {
                              setError(
                                err instanceof Error ? err.message : "Delete failed"
                              );
                            }
                          }}
                        >
                          Delete
                        </SecondaryButton>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Scrim for the overlay (below xl) versions of the drawer */}
          <button
            type="button"
            aria-label="Close part details"
            tabIndex={-1}
            onClick={closeDrawer}
            className={`fixed inset-0 z-30 bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 ease-out xl:hidden ${
              drawerShown ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />

          <aside
            aria-label="Part details"
            aria-hidden={!drawerShown}
            inert={!drawerShown}
            className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-3xl border border-white/10 bg-zinc-900/90 backdrop-blur-xl shadow-2xl shadow-black/50 transition-all duration-300 ease-out md:inset-x-auto md:inset-y-0 md:right-0 md:max-h-none md:w-96 md:rounded-t-none md:rounded-l-3xl xl:sticky xl:top-6 xl:z-auto xl:max-h-[calc(100dvh-3rem)] xl:translate-x-0 xl:translate-y-0 xl:self-start xl:overflow-hidden xl:rounded-2xl xl:bg-zinc-900/40 ${
              drawerShown
                ? "translate-y-0 md:translate-x-0 xl:ml-6 xl:w-96 xl:opacity-100"
                : "translate-y-full md:translate-y-0 md:translate-x-full xl:ml-0 xl:w-0 xl:border-transparent xl:opacity-0"
            }`}
          >
            {activeListing ? (
              <PartDrawerContent
                key={`${activeListing.key}-${drawerEpoch}`}
                part={activeListing.part}
                statusName={activeListing.statusName}
                quantity={activeListing.quantity}
                canEditDescription={
                  canManage &&
                  Boolean(activeListing.part.part_catalog) &&
                  !activeListing.part.part_catalog?.is_official &&
                  activeListing.part.part_catalog?.team_id === teamId
                }
                canManage={canManage}
                onClose={closeDrawer}
                onSaved={async () => {
                  if (teamId) await refresh(teamId);
                }}
              />
            ) : null}
          </aside>
          </div>
        </>
      )}
    </AppShell>
    
  );
}

function PartDrawerContent({
  part,
  statusName,
  quantity,
  canEditDescription,
  canManage,
  onClose,
  onSaved,
}: {
  part: Part;
  statusName: string;
  quantity: number;
  canEditDescription: boolean;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const catalog = part.part_catalog;
  const description = catalog?.description?.trim() ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updatePartDescription(part.id, draft);
      await onSaved();
      setEditing(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save description");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`flex min-h-0 w-full flex-col gap-5 overflow-y-auto p-5 md:p-6 xl:w-96 ${SCROLLBAR}`}
    >
      <div className="flex items-start justify-between gap-3">
        <Label>Part details</Label>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close part details"
          className="-mt-2 -mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-800/60 text-zinc-200 transition-all hover:bg-zinc-700/60 active:scale-95"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <h2 className="break-words bg-gradient-to-b from-zinc-100 to-zinc-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
        {catalog?.name ?? "Unnamed Part"}
      </h2>

      <dl className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            SKU
          </dt>
          <dd className="mt-1 break-all font-mono text-sm text-zinc-100">
            {catalog?.sku || "No SKU"}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Quantity
          </dt>
          <dd className="mt-1 font-mono text-2xl font-semibold text-zinc-100">
            {quantity}
          </dd>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
          <dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Status
          </dt>
          <dd className="mt-1 break-words text-sm text-zinc-100">{statusName}</dd>
        </div>
      </dl>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Description</Label>
          {canEditDescription && !editing ? (
            <SecondaryButton type="button" onClick={() => setEditing(true)}>
              Edit
            </SecondaryButton>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-3">
            <FieldInput
              as="textarea"
              aria-label="Part description"
              rows={6}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
            />
            <ErrorText>{saveError}</ErrorText>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton type="button" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setDraft(description);
                  setSaveError(null);
                }}
              >
                Cancel
              </SecondaryButton>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-400">
            {description || "No description"}
          </p>
        )}

        {canManage && !canEditDescription && !editing ? (
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Official catalog descriptions are read-only
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 px-4 py-1.5 rounded-xl text-[10px] font-mono uppercase tracking-wider border transition-all duration-300 ease-out ${
        active
          ? "border-emerald-400/40 bg-emerald-500/10 text-zinc-100"
          : "border-white/10 bg-zinc-900/40 text-zinc-500 hover:bg-zinc-800/50 hover:border-white/20 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}