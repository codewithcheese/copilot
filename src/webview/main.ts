import App from './App.svelte';

console.log('Hello from main.ts!');

const app = new App({
  target: document.getElementById('app')!,
});

export default app;
