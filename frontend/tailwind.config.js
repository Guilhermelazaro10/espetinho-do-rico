/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'rico-red': '#b32a2a',
        'rico-wood': '#d4a96e',
        'rico-dark': '#3f2b1d',
        'rico-light': '#fffcf7',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
        display: ['Alfa Slab One', 'serif'],
      },
    },
  },
};
