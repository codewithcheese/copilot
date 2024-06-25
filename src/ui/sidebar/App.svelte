<script lang="ts">
  import "../app.css";
  import { Button } from "$ui/components/ui/button";
  import { onMount } from "svelte";
  import { PlusIcon } from "lucide-svelte";

  let vscode: any;

  onMount(() => {
    vscode = acquireVsCodeApi();
  });

  function openChatPanel() {
    console.log("openChatPanel");
    vscode.postMessage({
      command: "openChatPanel",
    });
  }
</script>

<div class="flex flex-row">
  <div class="flex-1" />
  <Button
    class="rounded-3xl p-1 h-10 w-10 hover:bg-white"
    onclick={openChatPanel}
    variant="ghost"
  >
    <PlusIcon class="w-5 h-5" />
  </Button>
</div>
