import type { Task } from "$lib/types";

export function generateTaskPrompt(task: Task): string {
	const lines: string[] = [];

	lines.push(`# Task: ${task.name}`);
	lines.push("");
	lines.push(`**Status:** ${task.state}`);
	lines.push(`**Progress:** ${task.progress ?? 0}%`);
	lines.push("");

	if (task.description) {
		lines.push("## Description");
		lines.push(task.description);
		lines.push("");
	}

	if (task.questions && task.questions.length > 0) {
		lines.push("## Questions");

		const openQuestions = task.questions.filter((q) => q.state === "Open");
		const resolvedQuestions = task.questions.filter((q) => q.state === "Resolved");

		if (openQuestions.length > 0) {
			lines.push("### Open Questions (need answers)");
			openQuestions.forEach((q, i) => {
				lines.push(`${i + 1}. ${q.question}`);
			});
			lines.push("");
		}

		if (resolvedQuestions.length > 0) {
			lines.push("### Resolved Questions (for context)");
			resolvedQuestions.forEach((q, i) => {
				lines.push(`${i + 1}. Q: ${q.question}`);
				if (q.answer) {
					lines.push(`   A: ${q.answer}`);
				}
			});
			lines.push("");
		}
	}

	if (task.subtasks && task.subtasks.length > 0) {
		lines.push("## Subtasks");
		task.subtasks.forEach((subtask) => {
			const checkbox = subtask.state === "Completed" ? "[x]" : "[ ]";
			lines.push(`- ${checkbox} ${subtask.name} (${subtask.state})`);
		});
		lines.push("");
	}

	if (task.readme) {
		lines.push("## Plan Document");
		lines.push(task.readme);
		lines.push("");
	}

	lines.push("---");
	lines.push(`Task folder: ${task.path}`);
	lines.push("");
	lines.push("This is a Productmap task.");
	lines.push("Read productmap/README.md for more information about Productmap and how to use it.");

	return lines.join("\n");
}
