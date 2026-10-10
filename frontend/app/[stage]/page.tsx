import Home from "../page";
import { notFound } from "next/navigation";

export default async function StagePage({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  if (!["profile", "positioning", "topics", "script", "operate", "review"].includes(stage)) notFound();
  return <Home />;
}
