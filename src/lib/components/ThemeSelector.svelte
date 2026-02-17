<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Sun, Moon, Monitor } from "lucide-svelte";
	import type { Theme } from "$lib/types";
	import Dropdown from "./Dropdown.svelte";

	export let theme: Theme = "system";

	const dispatch = createEventDispatcher<{
		change: Theme;
	}>();

	const options: { value: Theme; label: string; icon: typeof Sun }[] = [
		{ value: "light", label: "Light", icon: Sun },
		{ value: "dark", label: "Dark", icon: Moon },
		{ value: "system", label: "System", icon: Monitor }
	];

	function handleChange(e: CustomEvent<Theme>) {
		dispatch("change", e.detail);
	}
</script>

<Dropdown {options} value={theme} header="Theme" on:change={handleChange} />
