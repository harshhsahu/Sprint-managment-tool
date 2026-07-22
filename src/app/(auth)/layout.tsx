import { Kanban } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
            <Kanban size={22} />
          </span>
          <span className="text-2xl font-bold tracking-tight">SprintBoard</span>
        </div>
        {children}
      </div>
    </div>
  );
}
