import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12131a',
        surface: '#f6f6f9',
      },
    },
  },
  plugins: [],
};

export default config;
