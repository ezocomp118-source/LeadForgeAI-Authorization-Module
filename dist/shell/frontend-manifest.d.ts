type ManifestEntry = {
    readonly file: string;
    readonly css?: ReadonlyArray<string>;
};
type Manifest = Record<string, ManifestEntry>;
type EntryAssets = {
    readonly scriptPath: string;
    readonly stylePaths: ReadonlyArray<string>;
};
export declare const loadManifest: (root: string) => Manifest | null;
export declare const lookupEntryAssets: (manifest: Manifest | null, entryKey: string) => EntryAssets | null;
export declare const renderHtmlShell: (assets: EntryAssets, title: string) => string;
export {};
