import React from "react";
import Navbar from "@/features/landing/Navbar";
import Hero from "@/features/landing/Hero";
import HeroAiDemo from "@/features/landing/HeroAiDemo";
import Features from "@/features/landing/Features";
import CodeTypingSection from "@/features/landing/CodeTypingSection";
import CipherPlayground from "@/features/landing/CipherPlayground";
import SecurityDocs from "@/features/landing/SecurityDocs";
import Pricing from "@/features/landing/Pricing";
import Footer from "@/features/landing/Footer";

export default function LandingPage() {
  return (
    <div
      data-testid="landing-page"
      className="relative min-h-screen text-[#f5f5f5] overflow-x-hidden"
      style={{ background: "#000" }}
    >
      <Navbar />
      <main>
        <Hero />
        <HeroAiDemo />
        <Features />
        <CodeTypingSection />
        <CipherPlayground />
        <SecurityDocs />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}