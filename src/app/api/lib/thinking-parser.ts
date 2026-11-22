export function createReasoningSummaryParser(
  onSummary: (text: string) => void,
  onAnswer: (text: string) => void
) {
  const OPEN_TAGS = ["<reasoning_summary>", "<think>", "<thought>", "<reasoning>"];
  const CLOSE_TAGS = ["</reasoning_summary>", "</think>", "</thought>", "</reasoning>"];
  const ANSWER_OPEN_TAGS = ["<final_answer>", "<answer>"];
  const ANSWER_CLOSE_TAGS = ["</final_answer>", "</answer>"];

  let phase: "prefix" | "summary" | "answer_prefix" | "answer" | "passthrough" | "done" = "prefix";
  let activeCloseTag = "</reasoning_summary>";
  let buffer = "";

  const emitBeforePartialMarker = (marker: string, emit: (text: string) => void) => {
    let held = Math.min(buffer.length, marker.length - 1);
    while (held > 0 && !marker.startsWith(buffer.slice(-held))) held -= 1;
    const safeLength = buffer.length - held;
    if (safeLength > 0) emit(buffer.slice(0, safeLength));
    buffer = buffer.slice(safeLength);
  };

  const push = (chunk: string) => {
    buffer += chunk;
    while (buffer) {
      if (phase === "prefix") {
        const trimmed = buffer.replace(/^\s+/, "");
        if (!trimmed) {
          if (buffer.length > 50) {
            phase = "passthrough";
            continue;
          }
          return;
        }

        let matchedTag: string | null = null;
        let isPartial = false;
        for (const tag of OPEN_TAGS) {
          if (trimmed.startsWith(tag)) {
            matchedTag = tag;
            break;
          }
          if (tag.startsWith(trimmed)) {
            isPartial = true;
          }
        }

        if (matchedTag) {
          const tagIdx = buffer.indexOf(matchedTag);
          buffer = buffer.slice(tagIdx + matchedTag.length);
          if (matchedTag === "<think>") activeCloseTag = "</think>";
          else if (matchedTag === "<thought>") activeCloseTag = "</thought>";
          else if (matchedTag === "<reasoning>") activeCloseTag = "</reasoning>";
          else activeCloseTag = "</reasoning_summary>";
          phase = "summary";
          continue;
        }

        if (isPartial) {
          return;
        }

        phase = "passthrough";
        continue;
      }

      if (phase === "summary") {
        const closeAt = buffer.indexOf(activeCloseTag);
        if (closeAt >= 0) {
          onSummary(buffer.slice(0, closeAt));
          buffer = buffer.slice(closeAt + activeCloseTag.length);
          phase = "answer_prefix";
          continue;
        }

        let otherCloseAt = -1;
        let matchedOtherCloseTag = "";
        for (const ct of CLOSE_TAGS) {
          const idx = buffer.indexOf(ct);
          if (idx >= 0 && (otherCloseAt === -1 || idx < otherCloseAt)) {
            otherCloseAt = idx;
            matchedOtherCloseTag = ct;
          }
        }
        if (otherCloseAt >= 0) {
          onSummary(buffer.slice(0, otherCloseAt));
          buffer = buffer.slice(otherCloseAt + matchedOtherCloseTag.length);
          phase = "answer_prefix";
          continue;
        }

        emitBeforePartialMarker(activeCloseTag, onSummary);
        return;
      }

      if (phase === "answer_prefix") {
        const trimmed = buffer.replace(/^\s+/, "");
        if (!trimmed) {
          if (buffer.length > 50) {
            phase = "passthrough";
            continue;
          }
          return;
        }

        let matchedAnswerTag: string | null = null;
        let isPartial = false;
        for (const tag of ANSWER_OPEN_TAGS) {
          if (trimmed.startsWith(tag)) {
            matchedAnswerTag = tag;
            break;
          }
          if (tag.startsWith(trimmed)) {
            isPartial = true;
          }
        }

        if (matchedAnswerTag) {
          const tagIdx = buffer.indexOf(matchedAnswerTag);
          buffer = buffer.slice(tagIdx + matchedAnswerTag.length);
          phase = "answer";
          continue;
        }

        if (isPartial) {
          return;
        }

        phase = "passthrough";
        continue;
      }

      if (phase === "answer") {
        let closeAt = -1;
        for (const tag of ANSWER_CLOSE_TAGS) {
          const idx = buffer.indexOf(tag);
          if (idx >= 0 && (closeAt === -1 || idx < closeAt)) {
            closeAt = idx;
          }
        }

        if (closeAt >= 0) {
          onAnswer(buffer.slice(0, closeAt));
          buffer = "";
          phase = "done";
          return;
        }

        emitBeforePartialMarker("</final_answer>", onAnswer);
        return;
      }

      if (phase === "passthrough") {
        const thinkIdx = buffer.indexOf("<think>");
        if (thinkIdx >= 0) {
          if (thinkIdx > 0) {
            onAnswer(buffer.slice(0, thinkIdx));
          }
          buffer = buffer.slice(thinkIdx + "<think>".length);
          activeCloseTag = "</think>";
          phase = "summary";
          continue;
        }

        onAnswer(buffer);
        buffer = "";
        return;
      }

      return;
    }
  };

  return {
    push,
    flush() {
      if (!buffer) return;
      if (phase === "summary") onSummary(buffer);
      else if (phase !== "done") onAnswer(buffer);
      buffer = "";
    },
  };
}
