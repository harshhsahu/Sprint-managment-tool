import { KanboWordmark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center">
          <KanboWordmark size={40} />
        </div>
        {children}
      </div>
    </div>
  );
}
