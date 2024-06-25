import App from "./App.svelte";
import { mount } from "svelte";

console.log("Hello from sidebar index!");

mount(App, {
  target: document.getElementById("app")!,
});
