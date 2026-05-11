import React from "react";
import { Link } from "react-router-dom";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-base text-slate-100">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <Link to="/" className="text-lg font-semibold text-slate-100">
              VolatiliWeb
            </Link>
            <p className="text-xs text-slate-400">Memory forensics console</p>
          </div>
          <div className="text-sm text-slate-400">Local-only</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
};

export default Layout;
