import { resolve } from "node:path";
import { defineConfig } from "vite";

const rootDir = new URL(".", import.meta.url).pathname;

// CHANGE: Multi-page build for admin invitations and registration screens
// WHY: Serve static UI from Express while keeping API base at /api
// QUOTE(ТЗ): "Вариант доставки UI: (A) ... сервить в нашем Express на /auth-admin/*"
// REF: REQ-INVITES-UI
// PURITY: CORE (build config)
export default defineConfig({
	build: {
		outDir: "dist",
		rollupOptions: {
			input: {
				authAdmin: resolve(rootDir, "web/auth-admin.html"),
				register: resolve(rootDir, "web/register.html"),
			},
		},
	},
});
