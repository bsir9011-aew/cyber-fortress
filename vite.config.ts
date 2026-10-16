import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/cyber-fortress/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
