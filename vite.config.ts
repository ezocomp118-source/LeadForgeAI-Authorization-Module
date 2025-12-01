import { resolve } from "node:path";
import { defineConfig } from "vite";

const rootDir = new URL(".", import.meta.url).pathname;

export default defineConfig({
	build: {
		outDir: "dist",
		manifest: true,
		rollupOptions: {
			input: {
				authAdmin: resolve(rootDir, "react-admin/src/auth-admin.tsx"),
				register: resolve(rootDir, "react-admin/src/register.tsx"),
			},
		},
	},
});
