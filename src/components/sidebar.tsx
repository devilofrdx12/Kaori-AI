"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquarePlus, 
  MessageSquare, 
  Archive, 
  Blocks, 
  Code,
  PanelLeftClose,
  ChevronDown,
  Trash2,
  Star
} from "lucide-react";
import { ChatThread } from "./chat-types";

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onToggleStarChat,
  open,
  onToggle,
  user,
  onOpenSettings,
  activeTab,
  onTabChange,
}: {
  chats: ChatThread[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;
  onToggleStarChat: (id: string, isStarred: boolean) => void;
  open: boolean;
  onToggle: () => void;
  user: { id: string; name: string; email: string } | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const closeMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) onToggle();
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/35 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.aside
        initial={false}
        animate={open ? { x: 0 } : { x: "calc(-100% - 24px)" }}
        transition={{ type: "spring", stiffness: 330, damping: 34, mass: 0.9 }}
        className="fixed left-3 top-3 bottom-3 sm:left-4 sm:top-4 sm:bottom-4 z-40 w-[min(20rem,calc(100vw-1.5rem))] lg:w-72 bg-white/40 dark:bg-neutral-950/40 backdrop-blur-[40px] rounded-[2rem] border border-white/40 dark:border-white/10 shadow-[0_8px_32px_hsl(220_30%_10%/0.08)] flex flex-col font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-6 sm:pt-8 pb-4">
          <span className="font-headline text-2xl tracking-tighter text-on-surface font-light">
            Kaori
          </span>
          <button
            onClick={onToggle}
            className="h-9 w-9 grid place-items-center rounded-xl text-secondary hover:text-on-surface hover:bg-white/55 dark:hover:bg-white/10 transition-all duration-200 active:scale-90"
            title="Close sidebar"
          >
            <PanelLeftClose size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Main Nav Items */}
        <div className="px-4 space-y-1 mt-2">
          <button 
            onClick={() => { onNewChat(); closeMobile(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface hover:bg-white/45 dark:hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:scale-105 active:-translate-y-0.5 active:scale-[0.98] group"
          >
            <MessageSquarePlus size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform text-secondary" />
            <span className="font-headline tracking-tight font-light">New chat</span>
          </button>
          <button 
            onClick={() => { onTabChange('chats'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group ${activeTab === 'chats' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm scale-105 -translate-y-1' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light hover:-translate-y-1 hover:scale-105 active:-translate-y-0.5 active:scale-[0.98]'}`}
          >
            <MessageSquare size={18} strokeWidth={1.5} className={activeTab === 'chats' ? 'text-primary' : 'group-hover:scale-110 transition-transform'} />
            <span className="font-headline tracking-tight">Chats</span>
          </button>
          <button 
            onClick={() => { onTabChange('projects'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group ${activeTab === 'projects' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm scale-105 -translate-y-1' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light hover:-translate-y-1 hover:scale-105 active:-translate-y-0.5 active:scale-[0.98]'}`}
          >
            <Archive size={18} strokeWidth={1.5} className={activeTab === 'projects' ? 'text-primary' : 'group-hover:scale-110 transition-transform'} />
            <span className="font-headline tracking-tight">Projects</span>
          </button>
          <button 
            onClick={() => { onTabChange('artifacts'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group ${activeTab === 'artifacts' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm scale-105 -translate-y-1' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light hover:-translate-y-1 hover:scale-105 active:-translate-y-0.5 active:scale-[0.98]'}`}
          >
            <Blocks size={18} strokeWidth={1.5} className={activeTab === 'artifacts' ? 'text-primary' : 'group-hover:scale-110 transition-transform'} />
            <span className="font-headline tracking-tight">Artifacts</span>
          </button>
          <button 
            onClick={() => { onTabChange('code'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group ${activeTab === 'code' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm scale-105 -translate-y-1' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light hover:-translate-y-1 hover:scale-105 active:-translate-y-0.5 active:scale-[0.98]'}`}
          >
            <Code size={18} strokeWidth={1.5} className={activeTab === 'code' ? 'text-primary' : 'group-hover:scale-110 transition-transform'} />
            <span className="font-headline tracking-tight">Code</span>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 mt-5 sm:mt-6">
          {/* Starred */}
          {chats.some(c => c.isStarred) && (
            <div className="mb-6">
              <div className="px-3 py-1.5 text-xs font-medium text-secondary uppercase tracking-widest">
                Starred
              </div>
              <div className="space-y-1">
                {chats.filter(c => c.isStarred).map(chat => {
                  const active = chat.id === activeChatId;
                  return (
                    <div
                      key={chat.id}
                      className={`group relative flex items-center w-full rounded-xl transition-all duration-300 ${
                        active
                          ? "bg-white/60 dark:bg-white/10 shadow-sm"
                          : "hover:bg-white/45 dark:hover:bg-white/10"
                      }`}
                    >
                      <button
                        onClick={() => { onSelectChat(chat.id); closeMobile(); }}
                        className={`flex-1 text-left px-4 py-3 text-sm truncate font-headline ${
                          active
                            ? "text-on-surface font-medium"
                            : "text-secondary font-light"
                        }`}
                      >
                        {chat.title}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStarChat(chat.id, false);
                        }}
                        className="absolute right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-white/60 dark:hover:bg-neutral-700 text-yellow-500 active:scale-90"
                        title="Unstar chat"
                      >
                        <Star size={14} fill="currentColor" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recents */}
          <div>
            <div className="px-3 py-1.5 text-xs font-medium text-secondary uppercase tracking-widest">
              Recents
            </div>
            <div className="space-y-1 pb-4">
              {chats.slice(0, 10).map((chat) => {
                const active = chat.id === activeChatId;
                return (
                  <div
                    key={chat.id}
                    className={`group relative flex items-center w-full rounded-xl transition-all duration-300 ${
                      active
                        ? "bg-white/60 dark:bg-white/10 shadow-sm"
                        : "hover:bg-white/45 dark:hover:bg-white/10"
                    }`}
                  >
                    <button
                      onClick={() => { onSelectChat(chat.id); closeMobile(); }}
                      className={`flex-1 text-left px-4 py-3 text-sm truncate font-headline ${
                        active
                          ? "text-on-surface font-medium"
                          : "text-secondary font-light"
                      }`}
                    >
                      {chat.title}
                    </button>
                    <div className="absolute right-2 flex items-center opacity-0 group-hover:opacity-100 transition-all gap-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStarChat(chat.id, !chat.isStarred);
                        }}
                        className={`p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-neutral-700 active:scale-90 transition-transform ${
                          chat.isStarred ? "text-yellow-500" : "text-secondary hover:text-yellow-500"
                        }`}
                        title={chat.isStarred ? "Unstar chat" : "Star chat"}
                      >
                        <Star size={14} fill={chat.isStarred ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-white/60 dark:hover:bg-neutral-700 text-secondary hover:text-red-500 active:scale-90 transition-all"
                        title="Delete chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {chats.length === 0 && (
                <div className="px-4 py-2 text-sm text-secondary italic font-light">No recent chats</div>
              )}
            </div>
          </div>
        </div>

        {/* User section */}
        <div className="p-4 mt-auto bg-white/42 dark:bg-white/5 border border-white/55 dark:border-white/10 rounded-2xl mx-4 mb-5 sm:mb-6">
          <button 
            onClick={() => { onOpenSettings(); closeMobile(); }}
            className="w-full flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">bolt</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-bold text-on-surface truncate">
                  {user ? user.name : "Pro Plan"}
                </div>
                <div className="text-xs text-secondary truncate">
                  {user?.email ? "85% credits remaining" : "Signed in"}
                </div>
              </div>
            </div>
            <ChevronDown size={16} className="text-secondary group-hover:text-primary shrink-0 transition-colors" strokeWidth={1.5} />
          </button>
        </div>
      </motion.aside>
    </>
  );
}
