import { ChatMessage } from "./types";

export type ChatThread = {
  id: string;
  title: string;
  isStarred?: boolean;
  projectId?: string | null;
  messages: ChatMessage[];
  createdAt?: string;
  updatedAt?: string;
};
