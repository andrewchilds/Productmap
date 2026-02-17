export type TaskState = "Unstarted" | "In Progress" | "Completed";

export type TaskColor =
	| "gray"
	| "red"
	| "orange"
	| "yellow"
	| "lime"
	| "green"
	| "teal"
	| "cyan"
	| "blue"
	| "indigo"
	| "purple"
	| "pink";

export type QuestionState = "Open" | "Resolved";

export interface Question {
	id: string;
	state: QuestionState;
	question: string;
	answer: string;
}

export interface TaskMeta {
	state: TaskState;
	color?: TaskColor;
	progress?: number;
	x: number;
	y: number;
	width: number;
	height: number;
	name: string;
	description: string;
	completedAt?: string;
	questions?: Question[];
}

export interface Task extends TaskMeta {
	id: string;
	path: string;
	readme: string;
	subtasks: Task[];
}

export interface Project {
	name: string;
	path: string;
}

export type Theme = "light" | "dark" | "system";

export interface AppSettings {
	projects: Project[];
	theme?: Theme;
}
