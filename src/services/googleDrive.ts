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

const DRIVE_STORAGE_ENDPOINT = "https://kiviwxonxeqmzqlmshpc.supabase.co/functions/v1/mw-drive-storage-summary";
const MW_TECH_DRIVE_KEY = "ADJ9w5w15Tinci91aHGav4vWjpqDqhq2NBeHqqOoQH4";
const CACHE_KEY = "drive-storage-summary:v2";
const CACHE_TTL = 15 * 60 * 1000;
let memoryCache = readFastCache<DriveStorageUsage>(CACHE_KEY, CACHE_TTL);
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
        "x-mw-tech-key": MW_TECH_DRIVE_KEY,
      },
      cache: "no-store",
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.error) {
      throw new Error(body?.error || "Não foi possível consultar o armazenamento do Google Drive.");
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
