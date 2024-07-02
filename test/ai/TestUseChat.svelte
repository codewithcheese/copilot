<script lang="ts">
  import { useChat } from "../../src/ai/use-chat.svelte";

  const { messages, error, isLoading, input, handleSubmit } = useChat({
    api: "http://localhost:3000/api/chat",
  });

  function onSubmit(event: Event) {
    event.preventDefault();
    handleSubmit();
  }
</script>

<div>
  {#if $isLoading}
    <p>Loading...</p>
  {:else if $error}
    <p>Error: {$error.message}</p>
  {:else}
    <ul>
      {#each $messages as message}
        <li>{message.role}: {message.content}</li>
      {/each}
    </ul>
  {/if}
</div>

<form on:submit={onSubmit}>
  <input bind:value={$input} placeholder="Type a message..." />
  <button type="submit">Send Message</button>
</form>
