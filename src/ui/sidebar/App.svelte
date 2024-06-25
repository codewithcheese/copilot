<script lang="ts">
  import "../app.css";
  import { Button } from "$ui/components/ui/button";

  let count = $state(0);
  function increment() {
    count += 1;
  }

  console.log("Hello from svelte!");
</script>

<main>
  <h1>Codewithcheese</h1>
  <Button variant="outline" onclick={increment}>
    Clicks: {count}
  </Button>
</main>
