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

export async function getDriveStorageUsage(): Promise<DriveStorageUsage> {
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

  return body as DriveStorageUsage;
}
