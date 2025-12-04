import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
const buildAssetPaths = (entry) => ({
    scriptPath: `/${entry.file}`,
    stylePaths: (entry.css ?? []).map((path) => `/${path}`),
});
export const loadManifest = (root) => {
    try {
        const manifestPath = join(root, "manifest.json");
        return JSON.parse(readFileSync(manifestPath, "utf8"));
    }
    catch {
        return null;
    }
};
export const lookupEntryAssets = (manifest, entryKey) => {
    if (!manifest) {
        return null;
    }
    const entry = manifest[entryKey];
    return entry ? buildAssetPaths(entry) : null;
};
const ShellDocument = ({ title, assets }) => (_jsxs("html", { lang: "en", children: [_jsxs("head", { children: [_jsx("meta", { charSet: "UTF-8" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }), _jsx("title", { children: title }), assets.stylePaths.map((href) => _jsx("link", { rel: "stylesheet", href: href }, href))] }), _jsxs("body", { children: [_jsx("div", { id: "root" }), _jsx("script", { type: "module", src: assets.scriptPath })] })] }));
export const renderHtmlShell = (assets, title) => `<!doctype html>${renderToStaticMarkup(_jsx(ShellDocument, { title: title, assets: assets }))}`;
