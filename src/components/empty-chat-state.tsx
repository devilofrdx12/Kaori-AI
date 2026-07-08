"use client";

import { Sparkles, Code2, BookOpen, PenLine, ListChecks } from "lucide-react";
import ChatInput from "./chat-input";

export default function EmptyChatState({
  greeting,
  userName,
  onSend,
  model,
  setModel,
}: {
  greeting: string;
  userName: string;
  onSend: (text: string, files?: File[] | null) => void;
  model: string;
  setModel: (m: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 w-full max-w-4xl mx-auto animate-spring-up will-change-transform transform-gpu pb-12 sm:pb-24 overflow-visible lg:rounded-[2rem]">
      <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl glass-panel text-primary animate-float animate-breathe">
          <Sparkles size={24} strokeWidth={1.5} className="animate-pulse" />
        </div>
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-headline font-light tracking-tight text-on-surface text-balance">
          {greeting}, {userName || "there"}
        </h1>
        <p className="mt-3 sm:mt-4 max-w-xl text-sm sm:text-base text-secondary font-light leading-relaxed">
          Start a focused chat, attach an image, or choose the best model for the task.
        </p>
      </div>
      <div className="w-full relative z-20 transition-all will-change-transform transform-gpu duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
        <ChatInput
          onSend={onSend}
          disabled={false}
          model={model}
          onModelChange={setModel}
          placeholder="How can I help you today?"
        />
      </div>

      <div className="relative z-30 flex overflow-x-auto sm:overflow-visible sm:flex-wrap items-center sm:justify-center gap-2.5 mt-5 w-[calc(100%+2rem)] sm:w-full max-w-3xl pb-2 px-4 sm:px-0 -mx-4 sm:mx-0 scrollbar-hide stagger-children">
        {[
          { icon: Code2, text: "Code", prompt: "Help me write some code" },
          { icon: Sparkles, text: "Create", prompt: "Help me create something new" },
          { icon: BookOpen, text: "Learn", prompt: "Explain a complex topic clearly" },
          { icon: PenLine, text: "Write", prompt: "Help me write an email or blog post" },
          { icon: ListChecks, text: "Plan", prompt: "Help me organize my next steps" },
        ].map((chip, i) => {
          const Icon = chip.icon;
          return (
            <button
              key={i}
              onClick={() => onSend(chip.prompt, null)}
              className="shrink-0 flex h-11 items-center justify-center gap-2 rounded-[1.25rem] glass-panel px-4 text-sm font-medium text-secondary hover-lift active-press hover:text-on-surface group"
            >
              <Icon size={16} className="text-neutral-500 dark:text-neutral-400" />
              {chip.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
