import MemoryGame from "./ui/MemoryGame";

export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold">Memory Game</h1>
        <p className="mt-2 text-gray-600">
          Questions are on the left. Answers are on the right. They are not intermixed.
        </p>

        <div className="mt-6">
          <MemoryGame />
        </div>
      </div>
    </main>
  );
}
