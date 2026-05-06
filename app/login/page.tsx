import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { messages } from "@/lib/messages";
import { signInWithGoogle } from "./actions";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{messages.app.name}</CardTitle>
          <CardDescription>{messages.app.tagline}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInWithGoogle}>
            <Button type="submit" size="lg" className="w-full">
              {messages.auth.signInWithGoogle}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
