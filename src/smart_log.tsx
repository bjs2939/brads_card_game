//smart_log.tsx
//C:\Users\brad330\Desktop\Brad's Work\Programs\Brads_Card_Game\smart_log.tsx

type SmartLogOptions = {
  componentName?: string;
};

let guiLogHandler: ((message: string) => void) | null = null;

function setGuiLogHandler(handler: (message: string) => void) {
  guiLogHandler = handler;
}

function getTimestamp() {
  const now = new Date();
  return now.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function extractCallerInfo() {
  const stack = new Error().stack;
  if (!stack) {
    return { file: "unknown", fn: "unknown" };
  }

  const lines = stack.split("\n").map(l => l.trim());

  // line 0 = Error
  // line 1 = smartLog
  // line 2 = actual caller (usually)
  const callerLine = lines[2] || "";

  const match = callerLine.match(/at\s+(.*)\s+\((.*):\d+:\d+\)/);

  if (!match) {
    return { file: "unknown", fn: "unknown" };
  }

  const fn = match[1];
  const filePath = match[2];
  const file = filePath.split("/").pop() || filePath;

  return { file, fn };
}

function smartLog(message: string, options?: SmartLogOptions) {
  const timestamp = getTimestamp();
  const caller = extractCallerInfo();

  const parts: string[] = [
    `[${timestamp}]`,
    `[${caller.file}]`,
  ];

  if (options?.componentName) {
    parts.push(`[component ${options.componentName}]`);
  }

  if (caller.fn && !caller.fn.includes("Object.")) {
    parts.push(`[fn ${caller.fn}]`);
  }

  const prefix = parts.join(" - ");
  const fullMessage = `${prefix} - ${message}`;

  console.log(fullMessage);

  try {
    // browser-safe persistent logging hook
    window.localStorage.setItem(
      "smartLog:last",
      fullMessage
    );
  } catch {
    // storage failure is non-fatal, do not log recursively
  }

  if (guiLogHandler) {
    guiLogHandler(fullMessage + "\n");
  }
}

export { smartLog, setGuiLogHandler };