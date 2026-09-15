import { Buffer } from 'buffer';

window.global = window;
window.Buffer = Buffer;
window.process = {
  env: {
    NODE_ENV: import.meta.env.MODE
  },
  version: '',
  nextTick: (fn: any) => setTimeout(fn, 0),
} as any;
