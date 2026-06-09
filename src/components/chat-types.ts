import { ChatMessage } from "./types";

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt?: string;
  updatedAt?: string;
};
