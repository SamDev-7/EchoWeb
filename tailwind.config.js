/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'dc-bg': '#313338'
			},
			fontFamily: {
				gg: ['gg sans', 'sans-serif']
			}
		}
	},
	plugins: []
};
