<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<slot />
