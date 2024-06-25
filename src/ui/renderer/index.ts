import "../app.css";
import App from "./App.svelte";
import { mount } from "svelte";

console.log("Hello from renderer index!");

mount(App, {
  target: document.getElementById("app")!,
});
