/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      lineHeight: {
        tight: '0.95',
      },
    },
  },
  plugins: [],
  safelist: [
    { pattern: /.*/ }
  ],
  // This restores sensible defaults that Preflight removes
  corePlugins: {
    preflight: true,
  },
}