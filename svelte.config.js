import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: false
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		paths: {
			relative: true
		}
	}
};

export default config;
