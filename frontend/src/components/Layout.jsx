import React from "react";
import { Link } from "react-router-dom";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <Link to="/" className="text-lg font-semibold text-foreground">
              VolatiliWeb
            </Link>
            <p className="text-xs text-muted">Memory forensics console</p>
          </div>
          <div className="text-sm text-muted">Local-only</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
};

export default Layout;
