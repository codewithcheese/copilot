<script lang="ts">
  import "../app.css";
  import { Button } from "$ui/components/ui/button";
  import { HandIcon, MessageCircleIcon, PlusIcon } from "lucide-svelte";
  import { createTrpcClient } from "../../trpc/client";
  import { Label } from "$ui/components/ui/label";
  import { Input } from "$ui/components/ui/input";
  const trpc = createTrpcClient();

  let apiKey = $state("");

  async function openChatPanel() {
    await trpc.openChatPanel.mutate();
  }

  async function greet() {
    console.log("Sending greeting");
    const res = await trpc.greeting.query({ name: "Tom" });
    console.log("greet", res);
  }

  async function chat() {
    console.log("Sending chat");
    trpc.chat.subscribe(
      {
        messages: [{ role: "user", content: "Hello, how are you?" }],
        providerId: "openai",
        apiKey,
        baseURL: "https://api.openai.com/v1",
        modelName: "gpt-3.5-turbo",
      },
      {
        onData: (chunk) => {
          console.log("Received chunk:", chunk);
        },
        onError: (err) => {
          console.error("Subscription error:", err);
        },
        onComplete: () => {
          console.log("Chat completed");
        },
      }
    );
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
    onclick={chat}
    variant="ghost"
  >
    <MessageCircleIcon class="w-5 h-5" />
  </Button>
</div>
<div>
  <Label>API Key</Label>
  <Input bind:value={apiKey} />
</div>
