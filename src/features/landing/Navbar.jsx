import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Menu, X, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

const NAV = [
  { key: "features", href: "#features" },
  { key: "playground", href: "#playground" },
  { key: "security", href: "#security" },
  { key: "pricing", href: "#pricing" },
  { key: "docs", href: "#docs" },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="echo-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div
        className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
          scrolled
            ? "rounded-full glass-strong"
            : "rounded-2xl bg-transparent border border-transparent"
        }`}
      >
        <nav className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link
            to="/"
            onClick={() => window.scrollTo(0, 0)}
            data-testid="navbar-brand"
            className="flex items-center gap-2.5 group"
          >
            <img src="/echo-logo.svg" alt="ECHO Logo" className="h-9 w-9 object-contain" />
            <span className="text-lg font-semibold tracking-tight text-white">
              ECHO
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-8 text-sm text-[#cfcfcf]">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  data-testid={`navbar-link-${item.key}`}
                  href={item.href}
                  className="relative transition-colors hover:text-white"
                >
                  {t(`nav.${item.key}`)}
                  <span className="absolute -bottom-1 left-0 h-px w-0 bg-gradient-to-r from-[#7c3aed] to-[#a855f7] transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-sm font-medium text-[#cfcfcf] hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5 mr-1"
            >
              <Globe className="h-4 w-4" />
              {i18n.language.startsWith('es') ? 'ES' : 'EN'}
            </button>
            <Link
              data-testid="navbar-signin"
              to="/login"
              className="text-sm text-[#cfcfcf] hover:text-white transition-colors"
            >
              {t('nav.signin')}
            </Link>
            <Link
              data-testid="navbar-cta"
              to="/register"
              className="btn-primary !py-2.5 !px-5 text-sm"
            >
              <Lock className="h-4 w-4" />
              {t('nav.download')}
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            data-testid="navbar-mobile-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-white"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {/* Mobile sheet */}
        {open && (
          <div
            data-testid="navbar-mobile-sheet"
            className="md:hidden mt-2 rounded-2xl glass p-4"
          >
            <ul className="flex flex-col gap-3 text-[#e5e5e5]">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-2"
                  >
                    {t(`nav.${item.key}`)}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#download"
                  onClick={() => setOpen(false)}
                  className="btn-primary w-full mt-2 !py-2.5 text-sm"
                >
                  {t('nav.download')}
                </a>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}