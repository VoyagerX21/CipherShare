/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cipher: {
          bg: '#0b0f19',
          surface: '#111827',
          surfaceHover: '#1f2937',
          border: '#1e293b',
          borderLight: '#334155',
          primary: '#0ea5e9',
          primaryHover: '#0284c7',
          accent: '#6366f1',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          textMuted: '#94a3b8'
        }
      }
    },
  },
  plugins: [],
}
