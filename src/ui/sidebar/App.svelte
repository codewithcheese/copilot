<script lang="ts">
  import "../app.css";

  let count = $state(0);
  function increment() {
    count += 1;
  }

  console.log("Hello from svelte!");
</script>

<main>
  <h1>Codewithcheese</h1>
  <button onclick={increment}>
    Clicks: {count}
  </button>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 240px;
    margin: 0 auto;
  }
  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
  button {
    font-size: 2em;
    padding: 0.5em 1em;
    color: #ff3e00;
    background-color: rgba(255, 62, 0, 0.1);
    border: 2px solid #ff3e00;
    cursor: pointer;
  }
</style>
