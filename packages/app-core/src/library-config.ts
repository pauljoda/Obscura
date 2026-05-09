export interface LoadLibraryConfigDeps<TSettings, TRoot> {
  ensureSettings: () => Promise<TSettings>;
  loadRoots: () => Promise<TRoot[]>;
}

export interface LibraryConfigPayload<TSettings, TRoot> {
  settings: TSettings;
  roots: TRoot[];
}

export async function loadLibraryConfig<TSettings, TRoot>(
  deps: LoadLibraryConfigDeps<TSettings, TRoot>,
): Promise<LibraryConfigPayload<TSettings, TRoot>> {
  const [settings, roots] = await Promise.all([
    deps.ensureSettings(),
    deps.loadRoots(),
  ]);
  return { settings, roots };
}
