import { KaoriTool } from "@/app/api/lib/core-types";

export const TOOL_DEFINITIONS: KaoriTool[] = [
  {
    name: "web_search",
    description:
      "Search the web for real-time information. Use this when the user asks about current events, recent news, live data, or anything that may have changed after your training cutoff. Returns search results with titles, URLs, and snippets.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the web",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description:
      "Fetch and read the content of a specific webpage URL. Use this when the user provides a URL and wants you to read, summarize, or analyze its content. Returns the text content of the page.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The full URL to fetch content from",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "open_application",
    description: "Opens an application on the user's device. To force a desktop app to open, you MUST use its custom URI protocol (e.g. 'spotify://'). Also provide a fallback https URL.",
    input_schema: {
      type: "object" as const,
      properties: {
        appName: {
          type: "string",
          description: "The name of the application (e.g., 'Spotify', 'Notion')",
        },
        uriScheme: {
          type: "string",
          description: "The custom URI protocol for the desktop app (e.g., 'spotify://', 'notion://', 'vscode://')",
        },
        fallbackUrl: {
          type: "string",
          description: "The https:// fallback URL if the app isn't installed (e.g., 'https://open.spotify.com')",
        },
      },
      required: ["appName", "uriScheme", "fallbackUrl"],
    },
  },
  {
    name: "play_spotify",
    description: "Searches for a song on Spotify and plays it on the user's device. Use this when the user asks to play a specific song or type of song on Spotify.",
    input_schema: {
      type: "object" as const,
      properties: {
        songName: {
          type: "string",
          description: "The name of the song and artist to play",
        },
      },
      required: ["songName"],
    },
  },
  {
    name: "open_youtube",
    description: "Opens YouTube on the user's device. If a search query or video name is provided, it searches for that video. Use this when the user asks to open YouTube or play a specific video on YouTube.",
    input_schema: {
      type: "object" as const,
      properties: {
        videoName: {
          type: "string",
          description: "The name of the video to search for and play. Leave empty if the user just wants to open YouTube.",
        },
      },
      required: ["videoName"],
    },
  },
  {
    name: "analyze_pdf_visuals",
    description: "Use this tool to analyze the visual elements of a recently uploaded PDF. Call this tool ONLY if the user specifically asks about a graph, chart, table, or picture in a PDF, or if the PDF text says [IMAGE/GRAPH DETECTED] and the user wants to know more about it. This tool will native-upload the PDF to Gemini Vision and return a description of the visuals.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "What you want to know about the visuals in the PDF (e.g. 'Describe the graph on page 3')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_document",
    description: "Create and offer a downloadable document (PDF, Word, or Markdown) for the user. Use this when the user asks you to write a report, essay, code file, or any content and provide it as a file. The tool will return a clickable download link that you MUST include in your final response to the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        filename: {
          type: "string",
          description: "The name of the file to create, including the extension (e.g. 'report.pdf', 'summary.docx', 'notes.md')",
        },
        format: {
          type: "string",
          description: "The format of the document. Must be exactly 'pdf', 'docx', or 'md'.",
        },
        content: {
          type: "string",
          description: "The full content of the document, formatted in Markdown.",
        },
      },
      required: ["filename", "format", "content"],
    },
  }
];

export function getToolByName(name: string) {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}
