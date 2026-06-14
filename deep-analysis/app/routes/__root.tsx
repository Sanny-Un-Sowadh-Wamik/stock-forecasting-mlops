import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TrendingUp, BarChart2, Settings } from "lucide-react";
import { useState } from "react";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f" }}>
      <Header />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
        <Outlet />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header
      style={{
        borderBottom: "1px solid #1e1e2e",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        height: 52,
        background: "#0d0d14",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 24 }}>
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TrendingUp size={15} color="#fff" />
          </div>
          <span style={{ color: "#e8e8f0", fontWeight: 700, fontSize: 15 }}>
            DeepAnalysis
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 4 }}>
          <NavLink to="/" label="Analyze" />
          <NavLink to="/market" label="Market" />
          <NavLink to="/dashboard" label="Dashboard" />
          <NavLink to="/compare" label="Compare" />
          <NavLink to="/journal" label="Journal" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{ textDecoration: "none" }}
      activeProps={{
        style: { textDecoration: "none" },
      }}
    >
      {({ isActive }) => (
        <span
          style={{
            padding: "4px 12px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            color: isActive ? "#e8e8f0" : "#6b7280",
            background: isActive ? "#1a1a26" : "transparent",
            transition: "all 0.15s",
          }}
        >
          {label}
        </span>
      )}
    </Link>
  );
}
