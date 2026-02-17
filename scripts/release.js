#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";

const rl = createInterface({
	input: process.stdin,
	output: process.stdout
});

function prompt(question) {
	return new Promise((resolve) => {
		rl.question(question, resolve);
	});
}

function exec(cmd, options = {}) {
	console.log(`\n> ${cmd}`);
	execSync(cmd, { stdio: "inherit", ...options });
}

async function main() {
	// Read current version from package.json
	const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
	const currentVersion = packageJson.version;

	console.log(`Current version: ${currentVersion}`);
	const newVersion = await prompt("Enter new version (or press enter to keep current): ");

	const version = newVersion.trim() || currentVersion;
	const tag = `v${version}`;

	// Update package.json if version changed
	if (version !== currentVersion) {
		packageJson.version = version;
		writeFileSync("package.json", JSON.stringify(packageJson, null, "\t") + "\n");
		console.log(`Updated package.json to version ${version}`);
	}

	// Build the distributable
	console.log("\nBuilding distributable...");
	exec("npm run make");

	// Determine artifact path based on platform and arch
	const platform = process.platform;
	const arch = process.arch;
	const artifactName = `Productmap-${platform}-${arch}-${version}.zip`;
	const artifactPath = `out/make/zip/${platform}/${arch}/${artifactName}`;

	console.log(`\nArtifact: ${artifactPath}`);

	const shouldRelease = await prompt("\nCreate GitHub release? (y/n): ");

	if (shouldRelease.toLowerCase() === "y") {
		// Check for uncommitted changes
		try {
			execSync("git diff --quiet && git diff --staged --quiet", { stdio: "pipe" });
		} catch {
			console.log("\nCommitting version bump...");
			exec(`git add package.json`);
			exec(`git commit -m "Bump version to ${version}"`);
		}

		// Create and push tag
		console.log(`\nCreating tag ${tag}...`);
		try {
			exec(`git tag ${tag}`);
		} catch {
			console.log(`Tag ${tag} already exists, skipping...`);
		}

		exec(`git push origin main --tags`);

		// Create GitHub release
		const releaseNotes = await prompt("Enter release notes (or press enter for default): ");
		const notes = releaseNotes.trim() || `Productmap ${tag}`;

		console.log("\nCreating GitHub release...");
		exec(`gh release create ${tag} --title "Productmap ${tag}" --notes "${notes}" "${artifactPath}"`);

		console.log(`\nRelease ${tag} created successfully!`);
	} else {
		console.log("\nSkipping GitHub release. Artifact available at:");
		console.log(artifactPath);
	}

	rl.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
