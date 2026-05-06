export function unwrapTrpcData<T>(value: unknown): T | undefined {
  console.log("[unwrapTrpcData] Input:", value);
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first !== "object") {
    console.log("[unwrapTrpcData] Returning early:", value);
    return value as T | undefined;
  }

  const result = (first as any).result;
  if (result && typeof result === "object") {
    const data = result.data;
    if (data && typeof data === "object" && "json" in data) {
      console.log("[unwrapTrpcData] Returning result.data.json:", data.json);
      return data.json as T;
    }
    console.log("[unwrapTrpcData] Returning result.data:", data);
    return data as T;
  }

  const data = (first as any).data;
  if (data && typeof data === "object" && "json" in data) {
    console.log("[unwrapTrpcData] Returning data.json:", data.json);
    return data.json as T;
  }

  console.log("[unwrapTrpcData] Returning value as-is:", value);
  return value as T;
}

export function unwrapTrpcArray<T>(value: unknown): T[] {
  const unwrapped = unwrapTrpcData<unknown>(value);
  return Array.isArray(unwrapped) ? (unwrapped as T[]) : [];
}
