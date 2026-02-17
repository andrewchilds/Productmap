module.exports = {
	packagerConfig: {
		asar: {
			unpack: "**/node_modules/node-pty/**/*"
		},
		name: "Productmap",
		executableName: "productmap",
		icon: "./static/favicon",
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
