type ExecutionEnvironment = {
  runtime: "workers" | "node";
};

export function getExecutionEnvironment(): ExecutionEnvironment {
  if (typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== "undefined") {
    return { runtime: "workers" };
  }

  return { runtime: "node" };
}
