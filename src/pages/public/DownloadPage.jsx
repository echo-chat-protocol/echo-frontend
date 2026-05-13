import React from "react";
import {
  Apple,
  Smartphone,
  Monitor,
  Globe,
  Download,
  CheckCircle2,
  HardDriveDownload,
} from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const PLATFORMS = [
  {
    icon: Apple,
    name: "macOS",
    sub: "Universal · 12+",
    file: "echo_3.2.0_universal.dmg",
    size: "84 MB",
  },
  {
    icon: Monitor,
    name: "Windows",
    sub: "10/11 · x64 + ARM",
    file: "echo_3.2.0_setup.exe",
    size: "78 MB",
  },
  {
    icon: HardDriveDownload,
    name: "Linux",
    sub: ".deb · .rpm · AppImage",
    file: "echo_3.2.0_amd64.deb",
    size: "72 MB",
  },
  {
    icon: Smartphone,
    name: "iOS",
    sub: "iPhone & iPad · 16+",
    file: "App Store",
    size: "App Store",
  },
  {
    icon: Smartphone,
    name: "Android",
    sub: "8.0+ · F-Droid + Play",
    file: "echo_3.2.0.apk",
    size: "26 MB",
  },
  {
    icon: Globe,
    name: "Web",
    sub: "Chromium · Firefox · Safari",
    file: "app.echo.io",
    size: "no install",
  },
];

export default function DownloadPage() {
  return (
    <PageShell
      eyebrow="Product · Download"
      icon={Download}
      title={
        <>
          One ECHO,{" "}
          <span className="echo-gradient-text">every device.</span>
        </>
      }
      subtitle="Reproducible builds, signed binaries, transparent SHA-256 fingerprints — pick your platform."
    >
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {PLATFORMS.map(({ icon: Icon, name, sub, file, size }) => (
          <article
            key={name}
            className="glass cyber-border rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
                <Icon className="h-5 w-5 text-white" />
              </span>
              <div>
                <h3 className="text-lg font-semibold leading-tight">{name}</h3>
                <div className="text-xs text-[#a0a0a0]">{sub}</div>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-mono text-[12px] text-[#cfcfdc] flex items-center justify-between">
              <span className="truncate">{file}</span>
              <span className="text-[#7a7a8a] ml-3 shrink-0">{size}</span>
            </div>

            <a href="#" className="btn-primary mt-5 !py-2.5 text-sm">
              <Download className="h-4 w-4" /> Download
            </a>
          </article>
        ))}
      </section>

      <section className="mt-16 glass rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-[#a8f0c2]" />
          <h2 className="text-xl font-semibold">Verify your download</h2>
        </div>
        <p className="mt-2 text-sm text-[#b9b9c4]">
          Every release is reproducible and PGP-signed. Confirm the SHA-256
          fingerprint before installing.
        </p>
        <pre className="mt-5 rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-[12.5px] leading-relaxed text-[#e9e9ef] overflow-x-auto">
{`# 1. Download the binary and signature
curl -O https://dl.echo.io/echo_3.2.0_universal.dmg
curl -O https://dl.echo.io/echo_3.2.0_universal.dmg.sig

# 2. Import the ECHO release key
gpg --keyserver keys.openpgp.org --recv-keys 0xECHO320RELEASE

# 3. Verify
gpg --verify echo_3.2.0_universal.dmg.sig
sha256sum echo_3.2.0_universal.dmg
# expected: 7f9a1c4e…d2 (compare with /releases page)`}
        </pre>
      </section>
    </PageShell>
  );
}