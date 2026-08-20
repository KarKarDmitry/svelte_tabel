import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Встроенная CSRF-защита SvelteKit покрывает только form content-types и
		// блокирует запросы без Origin (ломает native на XP). CSRF для всех
		// state-changing запросов (+server.ts) реализован в hooks.server.ts (handleCsrf).
		csrf: {
			trustedOrigins: ['*']
		},
		adapter: adapter(),
		typescript: {
			config: (config) => ({
				...config,
				include: [...config.include, '../drizzle.config.ts']
			})
		}
	}
};

export default config;
