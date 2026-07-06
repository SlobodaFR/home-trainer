import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111111',
        canvas: '#ffffff',
        'soft-cloud': '#f5f5f5',
        mute: '#707072',
        success: '#007d48',
        hairline: '#cacacb',
      },
    },
  },
  plugins: [],
} satisfies Config;
