import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col items-center justify-center gap-4">
      <div className="text-[#333] text-6xl font-black">404</div>
      <p className="text-[#666] text-sm">Page not found.</p>
      <Link href="/" className="text-[#c9a84c] text-sm hover:underline">
        Back to SMGrade
      </Link>
    </div>
  );
}
