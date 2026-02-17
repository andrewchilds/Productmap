module.exports = {
	packagerConfig: {
		asar: {
			unpack: "**/node_modules/node-pty/**/*"
		},
		name: "Productmap",
		executableName: "productmap",
		icon: "./static/favicon",
		appBundleId: "com.productmap.app",
		osxSign: {
			identity: process.env.APPLE_IDENTITY,
			optionsForFile: () => ({
				entitlements: "./entitlements.plist",
				hardenedRuntime: true
			})
		},
		osxNotarize: process.env.APPLE_ID ? {
			appleId: process.env.APPLE_ID,
			appleIdPassword: process.env.APPLE_ID_PASSWORD,
			teamId: process.env.APPLE_TEAM_ID
		} : undefined,
		ignore: [
			/^\/src/,
			/^\/docs/,
			/^\/productmap/,
			/^\/\.svelte-kit/,
			/^\/\.git/,
			/^\/\.claude/,
			/^\/.DS_Store/,
			/^\/node_modules\/\.cache/,
			/\.md$/,
			/^\/tsconfig\.json$/,
			/^\/svelte\.config\.js$/,
			/^\/vite\.config\.ts$/,
			/^\/eslint\.config\.js$/,
			/^\/\.gitignore$/,
			/^\/\.npmrc$/
		]
	},
	rebuildConfig: {},
	makers: [
		{
			name: "@electron-forge/maker-squirrel",
			config: {}
		},
		{
			name: "@electron-forge/maker-zip",
			platforms: ["darwin", "linux"]
		},
		{
			name: "@electron-forge/maker-deb",
			config: {}
		},
		{
			name: "@electron-forge/maker-rpm",
			config: {}
		}
	],
	plugins: [
		{
			name: "@electron-forge/plugin-auto-unpack-natives",
			config: {}
		}
	],
	hooks: {
		generateAssets: async () => {
			// Build the SvelteKit app before packaging
			const { execSync } = require("child_process");
			console.log("Building SvelteKit app...");
			execSync("npm run build", { stdio: "inherit" });
		}
	}
};
