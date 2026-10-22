"use client";

import Image from "next/image";
import { useState } from "react";

export type CouncilPhase = "consulting" | "review" | "synthesis" | "complete" | "error";

export type CouncilParticipant = {
  model: string;
  label: string;
  status: string;
  role?: "prompt-refiner" | "answer-model";
};

export type CouncilActivity = {
  id: string;
  model: string;
  label: string;
  kind: "prompt-refinement" | "draft" | "peer-review";
  status: "working" | "complete" | "unavailable";
  content?: string;
  summary?: string;
  truncated?: boolean;
};

export type CouncilStatus = {
  phase: CouncilPhase | string;
  message?: string;
  model?: string;
  status?: string;
  models?: CouncilParticipant[];
  activities?: CouncilActivity[];
  activity?: CouncilActivity;
  progress?: number;
} | null;

type TaskState = "done" | "working" | "next" | "unavailable";

function getParticipantState(status: string): TaskState {
  if (status === "waiting") return "next";
  if (status === "ready") return "done";
  if (status === "unavailable") return "unavailable";
  return "working";
}

function stateLabel(state: TaskState) {
  return {
    done: "DONE",
    working: "WORKING",
    next: "NEXT",
    unavailable: "UNAVAILABLE",
  }[state];
}

function StatusLight({ state }: { state: TaskState }) {
  if (state === "unavailable") {
    return <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_hsl(38_92%_50%_/_0.45)]" />;
  }

  const source = state === "done"
    ? "/model-council/status-done.svg"
    : state === "working"
      ? "/model-council/status-working.svg"
      : "/model-council/status-next.svg";
  const size = state === "working" ? 20 : 8;

  return (
    <span className="relative size-2 shrink-0 overflow-visible" aria-hidden="true">
      <Image
        src={source}
        alt=""
        width={size}
        height={size}
        className={state === "working" ? "absolute -inset-[6px] max-w-none animate-pulse" : "block"}
      />
    </span>
  );
}

function CouncilTaskRow({
  title,
  detail,
  state,
  active = false,
  onClick,
  expanded,
  buttonLabel,
  controlsId,
}: {
  title: string;
  detail: string;
  state: TaskState;
  active?: boolean;
  onClick?: () => void;
  expanded?: boolean;
  buttonLabel?: string;
  controlsId?: string;
}) {
  const statusStyles = {
    done: "border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300",
    working: "border-primary/20 bg-primary/10 text-primary",
    next: "border-black/[0.06] bg-white/35 text-secondary dark:border-white/10 dark:bg-white/[0.04]",
    unavailable: "border-amber-500/20 bg-amber-500/[0.08] text-amber-700 dark:text-amber-300",
  } satisfies Record<TaskState, string>;

  return (
    <div role="listitem"
      className={`relative z-10 flex min-h-[49px] items-center gap-3 rounded-[15px] border px-3 py-2 transition-[background-color,border-color,box-shadow,transform] duration-300 hover:-translate-y-px ${
        active
          ? "border-primary/25 bg-primary/[0.075] shadow-[0_5px_16px_-8px_hsl(var(--primary)/0.34),inset_0_1px_1px_hsl(0_0%_100%/0.72)] dark:bg-primary/[0.10]"
          : "border-white/75 bg-white/40 shadow-[0_3px_8px_-4px_rgba(69,46,41,0.12),inset_0_1px_1px_hsl(0_0%_100%/0.55)] dark:border-white/10 dark:bg-white/[0.035]"
      }`}
    >
      <button type="button" onClick={onClick} aria-expanded={expanded} aria-controls={controlsId} aria-label={buttonLabel} disabled={!onClick} className="flex w-full min-w-0 items-center gap-3 text-left disabled:cursor-default">
        <StatusLight state={state} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-4 text-on-surface">{title}</p>
          <p className="mt-0.5 text-[9px] leading-[14px] text-secondary sm:text-[10px]">{detail}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[8px] font-semibold tracking-[0.08em] ${statusStyles[state]}`}>
          {stateLabel(state)}
        </span>
      </button>
    </div>
  );
}

export default function ModelCouncilProgress({ status, onDismiss }: { status: CouncilStatus; onDismiss?: () => void }) {
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  if (!status) return null;

  const participants = status.models ?? [];
  const completedDrafts = participants.filter((participant) => participant.status === "ready" || participant.status === "unavailable").length;
  const progress = status.phase === "complete" ? 100 : status.phase === "error" ? (status.progress ?? 12) : status.phase === "refine" ? 12 : status.phase === "consulting"
    ? Math.max(12, Math.min(60, 12 + Math.round((completedDrafts / Math.max(participants.length, 1)) * 48)))
    : status.phase === "review"
      ? 68
      : 88;
  const phaseLabel = status.phase === "complete" ? "COMPLETE" : status.phase === "error" ? "STOPPED" : status.phase === "refine" ? "PROMPT REFINEMENT" : status.phase === "consulting"
    ? "ROUND 1 · INDEPENDENT DRAFTS"
    : status.phase === "review"
      ? "CROSS-REVIEW"
      : "SYNTHESIS";
  const synthesisState: TaskState = status.phase === "complete" ? "done" : status.phase === "error" ? "unavailable" : status.phase === "consulting" || status.phase === "refine" ? "next" : "working";
  const synthesisDetail = status.phase === "complete"
    ? "Final response delivered; drafts and peer reviews are still available"
    : status.phase === "error"
      ? "Council stopped; completed drafts and reviews remain available"
      : status.phase === "refine"
        ? "GPT-OSS is refining the original request before the answer models begin"
        : status.phase === "consulting"
    ? "Begins when enough independent drafts are ready"
      : status.phase === "review"
        ? "Models compare drafts and check disagreements"
        : "Selected model synthesizes the reviewed answers";

  return (
    <section
      aria-label="Model Council progress"
      className="glass-panel mx-auto my-3 w-full max-w-3xl animate-fade-in p-4 sm:p-5"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-6 text-on-surface">Model Council</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-secondary">A team of models, working through one answer</p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.08] px-3 py-1.5 text-[9px] font-semibold tracking-[0.12em] text-primary shadow-[inset_0_1px_1px_hsl(0_0%_100%/0.6)]">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.55)]" />
          {phaseLabel}
        </span>
        {(status.phase === "complete" || status.phase === "error") && onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss Council activity" className="rounded-full px-2 py-1 text-secondary hover:bg-black/5 hover:text-on-surface dark:hover:bg-white/10">×</button>}
      </header>

      <div className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold tracking-[0.14em] text-secondary">ESTIMATED PROGRESS</p>
            <p className="mt-1 text-[11px] leading-4 text-on-surface/80">
              {status.message || "The models are sharing and checking their answers…"}
            </p>
          </div>
          <span className="shrink-0 text-lg font-semibold leading-none text-primary">{progress}%</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.07] shadow-[inset_0_1px_2px_rgba(58,38,33,0.10)] dark:bg-white/[0.08]"
          role="progressbar"
          aria-label="Estimated Model Council progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${progress}% phase-based estimate; provider token progress is not available`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-[#f07a55] to-[#fcad6e] shadow-[0_0_12px_hsl(var(--primary)/0.32)] transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h4 className="text-[9px] font-semibold tracking-[0.14em] text-secondary">WHAT EACH MODEL IS DOING</h4>
          <span className="text-[9px] text-secondary">{participants.length} providers</span>
        </div>
        <div role="list" className="relative space-y-2" aria-label="Council task statuses">
          {participants.length > 1 && (
            <span aria-hidden="true" className="absolute bottom-6 left-[17px] top-6 z-0 w-px bg-gradient-to-b from-emerald-500/25 via-primary/25 to-border/50" />
          )}
          {participants.map((participant) => {
            const state = participant.status === "reviewing" ? "working" : getParticipantState(participant.status);
            const detail = participant.role === "prompt-refiner"
              ? participant.status === "ready" ? "Refined the request only · does not answer or review" : "Refining the prompt without adding facts"
              : participant.status === "waiting"
                ? "Waiting for the refined prompt"
                : participant.status === "ready"
                  ? (status.phase === "review" ? "Draft complete · reviewing peer answers" : "Independent draft and peer review ready")
                  : participant.status === "unavailable"
                    ? "This provider did not return a draft"
                    : "Drafting an independent response";
            const isExpanded = expandedModel === participant.model;
            const activities = (status.activities ?? (status.activity ? [status.activity] : [])).filter((activity) => activity.model === participant.model);
            return (
              <div key={participant.model} className="space-y-1">
                <CouncilTaskRow title={participant.label} detail={detail} state={state} onClick={() => setExpandedModel(isExpanded ? null : participant.model)} expanded={isExpanded} controlsId={`council-${participant.model.replace(/[^a-z0-9]/gi, "-")}`} buttonLabel={`${isExpanded ? "Hide" : "Show"} ${participant.label} activity`} />
                {isExpanded && <div role="listitem" id={`council-${participant.model.replace(/[^a-z0-9]/gi, "-")}`} className="ml-3 space-y-2 rounded-xl border border-white/60 bg-white/35 p-3 text-[10px] dark:border-white/10 dark:bg-white/[0.03]">
                  {activities.length === 0 && <p className="text-secondary">This model’s draft and review have not arrived yet.</p>}
                  {activities.map((activity) => <div key={activity.id}>
                    <div className="flex items-center justify-between gap-2"><p className="font-semibold tracking-[0.08em] text-secondary">{activity.kind === "prompt-refinement" ? "REFINED PROMPT" : activity.kind === "draft" ? "INDEPENDENT DRAFT" : "PEER REVIEW"}</p><span className="text-[8px] uppercase tracking-wider text-secondary">{activity.status === "complete" ? "Done" : activity.status === "working" ? "Working" : "Unavailable"}</span></div>
                    {activity.summary && <div className="mt-2 rounded-lg border border-primary/10 bg-primary/[0.045] p-2.5"><p className="text-[8px] font-semibold tracking-[0.1em] text-primary">REASONING SUMMARY</p><p className="mt-1 whitespace-pre-wrap break-words leading-4 text-on-surface/90">{activity.summary}</p></div>}
                    <p className="mt-1 whitespace-pre-wrap break-words leading-4 text-on-surface/90">{activity.content || (activity.status === "working" ? "This model is preparing its response…" : "No response was returned.")}</p>
                    {activity.truncated && <p className="mt-1 text-secondary">Preview shortened for display.</p>}
                  </div>)}
                </div>}
              </div>
            );
          })}
          <CouncilTaskRow
            title="Review & synthesis"
            detail={synthesisDetail}
            state={synthesisState}
            active={synthesisState === "working"}
          />
        </div>
      </div>

      <p className="mt-3 text-[9px] leading-4 text-secondary/80">
        Progress is phase-based. Open a model to see its draft, concise reasoning summary, and peer-review note.
      </p>
    </section>
  );
}
