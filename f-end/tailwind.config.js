/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7ee',
          100: '#fdeed5',
          200: '#fad9aa',
          300: '#f7c474',
          400: '#f3a63c',
          500: '#f09316',
          600: '#e1780c',
          700: '#ba5e0c',
          800: '#944a12',
          900: '#783f12',
        },
        coffee: {
          50: '#faf9f7',
          100: '#f0ede7',
          200: '#e2ddd1',
          300: '#d0c7b8',
          400: '#b8aa98',
          500: '#a6937d',
          600: '#8b7355',
          700: '#6f5c47',
          800: '#5d4d3e',
          900: '#524238',
        }
      }
    },
  },
  plugins: [],
}