/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        primary: {
          light: '#8b5cf6',
          DEFAULT: '#7c3aed',
          dark: '#6d28d9',
          darker: '#5b21b6',
        },
        surface: {
          light: '#ffffff',
          'light-subtle': '#fbf8ff',
          'light-border': '#e9d5ff',
          dark: '#0f0c20',
          'dark-subtle': '#18132d',
          'dark-card': '#20193d',
          'dark-border': '#332559',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'purple-glow': '0 0 25px -5px rgba(124, 58, 237, 0.4)',
        'purple-card': '0 4px 20px -2px rgba(109, 40, 217, 0.15)',
      }
    },
  },
  plugins: [],
}
