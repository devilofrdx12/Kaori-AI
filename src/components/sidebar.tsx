"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MessageSquarePlus, 
  MessageSquare, 
  Archive, 
  Blocks, 
  Code,
  PanelLeftClose,
  ChevronDown
} from "lucide-react";
import { ChatThread } from "./chat-types";

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  open,
  onToggle,
  user,
  onLogout,
}: {
  chats: ChatThread[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;
  open: boolean;
  onToggle: () => void;
  user: { id: string; name: string; email: string } | null;
  onLogout: () => void;
}) {
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
            className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.aside
        initial={false}
        animate={open ? { x: 0 } : { x: -288 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 z-40 h-screen w-72 bg-[#f8f8f8] dark:bg-[#1c1c1c] border-r border-[#e5e5e5] dark:border-[#2a2a2a] flex flex-col font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4">
          <span className="font-serif text-2xl tracking-tight text-neutral-900 dark:text-neutral-100 font-medium">
            Kaori
          </span>
          <button
            onClick={onToggle}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
          >
            <PanelLeftClose size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Main Nav Items */}
        <div className="px-3 space-y-0.5 mt-2">
          <button 
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
          >
            <MessageSquarePlus size={16} strokeWidth={1.5} />
            New chat
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors">
            <MessageSquare size={16} strokeWidth={1.5} />
            Chats
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors">
            <Archive size={16} strokeWidth={1.5} />
            Projects
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors">
            <Blocks size={16} strokeWidth={1.5} />
            Artifacts
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors">
            <Code size={16} strokeWidth={1.5} />
            Code
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 mt-6">
          {/* Starred */}
          <div className="mb-6">
            <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Starred
            </div>
            <div className="space-y-0.5">
              <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors truncate">
                Seasonal Produce Guide
              </button>
              <button className="w-full text-left px-3 py-2 rounded-lg text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors truncate">
                Imagining Alternate Workplace...
              </button>
            </div>
          </div>

          {/* Recents */}
          <div>
            <div className="px-3 py-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Recents
            </div>
            <div className="space-y-0.5 pb-4">
              {chats.slice(0, 10).map((chat) => {
                const active = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                      active
                        ? "bg-[#efefef] dark:bg-[#2a2a2a] text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {chat.title}
                  </button>
                );
              })}
              {chats.length === 0 && (
                <div className="px-3 py-2 text-sm text-neutral-400 italic">No recent chats</div>
              )}
            </div>
          </div>
        </div>

        {/* User section */}
        <div className="p-4">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-xl hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors group"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 shrink-0 rounded-full bg-[#d66f8f] flex items-center justify-center text-white font-serif text-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">
                  {user ? user.name : "Sarah Chen"}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  Pro plan
                </div>
              </div>
            </div>
            <ChevronDown size={16} className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 shrink-0" strokeWidth={1.5} />
          </button>
        </div>
      </motion.aside>
    </>
  );
}
