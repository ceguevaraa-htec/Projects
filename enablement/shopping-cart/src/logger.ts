export interface LogEntry {
  action: string;
  cartId: string;
  productId?: string;
  timestamp: string;
}

/**
 * Writes one structured log line per call. Intended for use by the service layer only,
 * so business-meaningful mutations are logged regardless of how they were triggered
 * (constitution Principle III).
 */
export function log(entry: Omit<LogEntry, "timestamp">): void {
  const line: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  console.log(JSON.stringify(line));
}
