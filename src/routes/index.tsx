import { createFileRoute } from "@tanstack/react-router";
import { MemoryApp } from "@/game/MemoryApp";

export const Route = createFileRoute("/")({
  component: MemoryApp,
  head: () => ({
    meta: [
      { title: "Memory Match — Premium Card Game" },
      { name: "description", content: "Flip, match and beat your best time in this premium memory card game with 5 themes and combo streaks." },
    ],
  }),
});
