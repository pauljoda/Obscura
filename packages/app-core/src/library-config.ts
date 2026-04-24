export interface LoadLibraryConfigDeps<TSettings, TRoot, TStorage> {
  ensureSettings: () => Promise<TSettings>;
  loadRoots: () => Promise<TRoot[]>;
  loadStorage: () => Promise<TStorage>;
}

export interface LibraryConfigPayload<TSettings, TRoot, TStorage> {
  settings: TSettings;
  roots: TRoot[];
  storage: TStorage;
}

export async function loadLibraryConfig<TSettings, TRoot, TStorage>(
  deps: LoadLibraryConfigDeps<TSettings, TRoot, TStorage>,
): Promise<LibraryConfigPayload<TSettings, TRoot, TStorage>> {
  const [settings, roots, storage] = await Promise.all([
    deps.ensureSettings(),
    deps.loadRoots(),
    deps.loadStorage(),
  ]);
  return { settings, roots, storage };
}
