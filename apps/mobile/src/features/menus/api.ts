// Lightweight client stubs for menu ingestion and list conversions.
// Replace implementations with real backend calls when endpoints are ready.

export type SaveDishRequest = {
  title: string;
  premium: boolean;
};

export type UploadMode = 'camera' | 'gallery';

export async function uploadMenu(mode: UploadMode, premium: boolean) {
  // TODO: integrate with menu ingestion endpoint
  return Promise.resolve({
    status: 'ok' as const,
    premium,
    mode
  });
}

export async function saveDish(request: SaveDishRequest) {
  // TODO: call backend to create a menu card or title-only record
  return Promise.resolve({
    status: 'ok' as const,
    savedAsTitleOnly: !request.premium
  });
}

export async function openDish(id: string) {
  // TODO: fetch full recipe/menu card
  return Promise.resolve({ status: 'ok' as const, id });
}

export async function createListFromMenus(ids: string[], people: number) {
  // TODO: call list creation endpoint with merged list lines
  return Promise.resolve({ status: 'ok' as const, ids, people });
}
