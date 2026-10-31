/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        classic: {
          bg: '#f8fafc',
          surface: '#ffffff',
          surfaceHover: '#f1f5f9',
          border: '#e2e8f0',
          borderStrong: '#cbd5e1',
          navy: '#0f172a',
          navyLight: '#1e293b',
          primary: '#2563eb',
          primaryHover: '#1d4ed8',
          accent: '#4f46e5',
          muted: '#64748b',
          subtle: '#94a3b8'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
