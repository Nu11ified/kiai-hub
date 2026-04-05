export interface ListOptions {
  cursor?: string;
  limit?: number;
}

export interface ListResult {
  keys: { key: string; size: number; lastModified: Date }[];
  cursor?: string;
  hasMore: boolean;
}

export interface StorageProvider {
  put(key: string, data: ReadableStream | Uint8Array, metadata?: Record<string, string>): Promise<void>;
  get(key: string): Promise<{ data: ReadableStream; metadata: Record<string, string> } | null>;
  delete(key: string): Promise<void>;
  list(prefix: string, options?: ListOptions): Promise<ListResult>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}
