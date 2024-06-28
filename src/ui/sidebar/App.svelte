<script lang="ts">
  import "../app.css";
  import { Button } from "$ui/components/ui/button";
  import { HandIcon, MessageSquareWarningIcon, PlusIcon } from "lucide-svelte";
  import { trpc } from "../../trpc/client";

  async function openChatPanel() {
    await trpc.openChatPanel.mutate();
  }

  async function greet() {
    console.log("Sending greeting");
    const res = await trpc.greeting.query({ name: "Tom" });
    console.log("greet", res);
  }

  async function tryError() {
    try {
      await trpc.tryError.mutate();
    } catch (err) {
      console.log("Received error", err);
    }
  }
</script>

<div class="flex flex-row">
  <div class="flex-1">&nbsp;</div>
  <Button
    class="rounded-3xl p-1 h-10 w-10 hover:bg-white"
    onclick={openChatPanel}
    variant="ghost"
  >
    <PlusIcon class="w-5 h-5" />
  </Button>
  <Button
    class="rounded-3xl p-1 h-10 w-10 hover:bg-white"
    onclick={greet}
    variant="ghost"
  >
    <HandIcon class="w-5 h-5" />
  </Button>
  <Button
    class="rounded-3xl p-1 h-10 w-10 hover:bg-white"
    onclick={tryError}
    variant="ghost"
  >
    <MessageSquareWarningIcon class="w-5 h-5" />
  </Button>
</div>
