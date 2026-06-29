"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, LayoutDashboard } from "lucide-react";
import { clearTokens } from "@/lib/auth";
import LogoIcon from "@/components/LogoIcon";

interface NavbarProps {
  email?: string;
}

export default function Navbar({ email }: NavbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearTokens();
    router.push("/login");
  };

  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "rgba(4, 20, 18, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(16,185,129,0.1)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <LogoIcon size={36} />
          <span className="font-bold text-lg tracking-tight">
            <span className="text-white">Interview</span>
            <span style={{ color: "#F97316" }}>Ace</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="hidden sm:flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "rgba(110,231,183,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#6EE7B7")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(110,231,183,0.6)")}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>

          {email && (
            <span className="hidden md:block text-xs px-3 py-1.5 rounded-full"
              style={{
                color: "rgba(110,231,183,0.6)",
                background: "rgba(16,185,129,0.07)",
                border: "1px solid rgba(16,185,129,0.12)",
              }}>
              {email}
            </span>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-all"
            style={{ color: "rgba(110,231,183,0.5)", border: "1px solid transparent" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "#F87171";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(248,113,113,0.2)";
              (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "rgba(110,231,183,0.5)";
              (e.currentTarget as HTMLElement).style.borderColor = "transparent";
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}