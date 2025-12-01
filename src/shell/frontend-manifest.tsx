import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type ManifestEntry = {
  readonly file: string;
  readonly css?: ReadonlyArray<string>;
};

type Manifest = Record<string, ManifestEntry>;

type EntryAssets = {
  readonly scriptPath: string;
  readonly stylePaths: ReadonlyArray<string>;
};

const buildAssetPaths = (entry: ManifestEntry): EntryAssets => ({
  scriptPath: `/${entry.file}`,
  stylePaths: (entry.css ?? []).map((path) => `/${path}`),
});

export const loadManifest = (root: string): Manifest | null => {
  try {
    const manifestPath = join(root, "manifest.json");
    return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  } catch {
    return null;
  }
};

export const lookupEntryAssets = (
  manifest: Manifest | null,
  entryKey: string,
): EntryAssets | null => {
  if (!manifest) {
    return null;
  }
  const entry = manifest[entryKey];
  return entry ? buildAssetPaths(entry) : null;
};

type ShellDocumentProps = {
  readonly title: string;
  readonly assets: EntryAssets;
};

const ShellDocument: FC<ShellDocumentProps> = ({ title, assets }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      {assets.stylePaths.map((href) => <link key={href} rel="stylesheet" href={href} />)}
    </head>
    <body>
      <div id="root" />
      <script type="module" src={assets.scriptPath} />
    </body>
  </html>
);

export const renderHtmlShell = (assets: EntryAssets, title: string): string =>
  `<!doctype html>${renderToStaticMarkup(<ShellDocument title={title} assets={assets} />)}`;
