"use client";


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
      {open && (
        <div
          onClick={onToggle}
          className="fixed inset-0 bg-black/35 z-30 lg:hidden transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed left-3 top-3 bottom-3 sm:left-4 sm:top-4 sm:bottom-4 z-40 w-[min(20rem,calc(100vw-1.5rem))] lg:w-72 glass-panel shadow-[0_16px_48px_-12px_hsl(var(--primary)/0.2)] flex flex-col font-sans transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${open ? "translate-x-0 scale-100" : "-translate-x-[calc(100%+24px)] scale-[0.98]"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-6 sm:pt-8 pb-4">
          <span className="font-headline text-2xl tracking-tighter text-on-surface font-light">
            Kaori
          </span>
          <button
            onClick={onToggle}
            className="h-9 w-9 grid place-items-center rounded-xl text-secondary hover:text-on-surface hover:bg-white/55 dark:hover:bg-white/10 active-press hover-lift"
            title="Close sidebar"
          >
            <PanelLeftClose size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Main Nav Items */}
        <div className="px-4 space-y-1 mt-2">
          <button 
            onClick={() => { onNewChat(); closeMobile(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-[1.25rem] text-on-surface hover:bg-white/45 dark:hover:bg-white/10 active-press hover-lift group"
          >
            <MessageSquarePlus size={18} strokeWidth={1.5} className="group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] text-secondary" />
            <span className="font-headline tracking-tight font-light">New chat</span>
          </button>
          <button 
            onClick={() => { onTabChange('chats'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[1.25rem] active-press hover-lift group ${activeTab === 'chats' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light'}`}
          >
            <MessageSquare size={18} strokeWidth={1.5} className={activeTab === 'chats' ? 'text-primary' : 'group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]'} />
            <span className="font-headline tracking-tight">Chats</span>
          </button>
          <button 
            onClick={() => { onTabChange('projects'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[1.25rem] active-press hover-lift group ${activeTab === 'projects' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light'}`}
          >
            <Archive size={18} strokeWidth={1.5} className={activeTab === 'projects' ? 'text-primary' : 'group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]'} />
            <span className="font-headline tracking-tight">Projects</span>
          </button>
          <button 
            onClick={() => { onTabChange('artifacts'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[1.25rem] active-press hover-lift group ${activeTab === 'artifacts' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light'}`}
          >
            <Blocks size={18} strokeWidth={1.5} className={activeTab === 'artifacts' ? 'text-primary' : 'group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]'} />
            <span className="font-headline tracking-tight">Artifacts</span>
          </button>
          <button 
            onClick={() => { onTabChange('code'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[1.25rem] active-press hover-lift group ${activeTab === 'code' ? 'bg-white/60 dark:bg-white/10 text-on-surface font-medium shadow-sm' : 'text-secondary hover:bg-white/45 dark:hover:bg-white/10 font-light'}`}
          >
            <Code size={18} strokeWidth={1.5} className={activeTab === 'code' ? 'text-primary' : 'group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]'} />
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
                      className={`group relative flex items-center w-full rounded-[1.25rem] transition-colors duration-300 ${
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
                        className="absolute right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-white/60 dark:hover:bg-neutral-700 text-yellow-500 active-press"
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
                    className={`group relative flex items-center w-full rounded-[1.25rem] transition-colors duration-300 ${
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
                        className={`p-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-neutral-700 active-press transition-colors ${
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
                        className="p-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-neutral-700 text-secondary hover:text-red-500 active-press transition-colors"
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
        <button 
          onClick={() => { onOpenSettings(); closeMobile(); }}
          className="mt-auto mx-4 mb-5 sm:mb-6 flex items-center justify-between gap-3 group active-press hover-lift p-4 rounded-3xl glass-panel border-none shadow-none bg-white/20 dark:bg-white/5 hover:bg-white/30 dark:hover:bg-white/10 transition-colors text-left"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg font-headline">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
              </span>
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
          <ChevronDown size={18} className="text-secondary group-hover:text-primary shrink-0 transition-colors" strokeWidth={1.5} />
        </button>
      </aside>
    </>
  );
}
