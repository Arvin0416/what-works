"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { ThemeToggle } from "./theme-toggle";

const navigationItems = [
  { href: "#today-article", label: "Today" },
  { href: "#struggles", label: "Struggles" },
  { href: "#watch", label: "Watch" },
  { href: "#about", label: "About" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNavigationId = useId().replace(/:/g, "");

  return (
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link
          className="site-header__brand"
          href="/"
          aria-label="What Works Daily home"
        >
          <span className="site-header__brand-mark" aria-hidden="true">
            WW
          </span>
          <span>
            What Works
            <strong>Daily</strong>
          </span>
        </Link>

        <button
          className="site-header__menu-button"
          type="button"
          aria-controls={mobileNavigationId}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
        >
          <span>{menuOpen ? "Close" : "Menu"}</span>
          <span className="site-header__menu-bars" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>

        <nav
          id={mobileNavigationId}
          className={`site-header__nav${menuOpen ? " site-header__nav--open" : ""}`}
          aria-label="Primary navigation"
        >
          {navigationItems.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              {item.label}
            </a>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
