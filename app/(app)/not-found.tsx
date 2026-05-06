import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-lg font-semibold">Not found.</h2>
      <Link href="/dashboard">
        <Button variant="outline">Back to today</Button>
      </Link>
    </div>
  );
}
