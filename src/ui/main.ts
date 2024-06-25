import App from './App.svelte';
import {mount} from 'svelte';

console.log('Hello from main.ts!');

mount(App, {
  target: document.getElementById('app')!,
});
