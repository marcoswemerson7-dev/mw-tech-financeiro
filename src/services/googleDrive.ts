import { readFastCache, writeFastCache } from "../lib/fast-cache";

export type DriveFolderUsage = {
  id: string;
  name: string;
  bytes: number;
  usedGb: number;
  files: number;
  folders: number;
  percentOfTotal: number;
};

export type DriveStorageUsage = {
  totalGb: number;
  usedGb: number;
  availableGb: number;
  percent: number;
  folders: DriveFolderUsage[];
  updatedAt: string;
  account?: string;
};

const DRIVE_STORAGE_ENDPOINT = "/api/drive-storage";
const CACHE_KEY = "drive-storage-summary:v2";
const LEGACY_CACHE_KEY = "drive-storage-summary";
const CACHE_TTL = 15 * 60 * 1000;
const STALE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
let memoryCache = readFastCache<DriveStorageUsage>(CACHE_KEY, STALE_CACHE_TTL) || readFastCache<DriveStorageUsage>(LEGACY_CACHE_KEY, STALE_CACHE_TTL);
let memoryCacheAt = memoryCache ? Date.now() : 0;
let pending: Promise<DriveStorageUsage> | null = null;

export function getCachedDriveStorageUsage() {
  return memoryCache;
}

export async function getDriveStorageUsage(force = false): Promise<DriveStorageUsage> {
  if (!force && memoryCache && Date.now() - memoryCacheAt < CACHE_TTL) return memoryCache;
  if (!force && pending) return pending;

  const request = async () => {
    const response = await fetch(DRIVE_STORAGE_ENDPOINT, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) {
      const detail = body?.detail ? ` (${body.detail})` : "";
      if (memoryCache) return memoryCache;
      throw new Error(`${body?.error || "Não foi possível consultar o armazenamento do Google Drive."}${detail}`);
    }

    const data = body as DriveStorageUsage;
    memoryCache = data;
    memoryCacheAt = Date.now();
    writeFastCache(CACHE_KEY, data);
    return data;
  };

  if (force) return request();
  pending = request().finally(() => { pending = null; });
  return pending;
}
