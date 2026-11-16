import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// GitHub Pages 하위 경로(/StudyVerilog/)가 기본값이다.
// COM's 하위 경로 등으로 옮길 때는 VITE_BASE만 바꿔 빌드한다. (최종계획서 11.4)
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: env.VITE_BASE ?? '/StudyVerilog/',
    plugins: [react()],
    worker: { format: 'es' as const },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    },
  };
});
