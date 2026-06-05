import { Scale, ArrowUpRight } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const ECHO_LICENSES = [
  {
    name: "ECHO Clients (desktop, mobile, web)",
    license: "AGPL-3.0",
  },
  {
    name: "ECHO Server / Relay",
    license: "AGPL-3.0",
  },
  {
    name: "@echo/sdk · echo-rs · echo-swift · echo-kotlin",
    license: "Apache-2.0",
  },
  {
    name: "ECHO brand assets",
    license: "CC BY-NC 4.0",
  },
];

const THIRD_PARTY = [
  { name: "libsodium", license: "ISC" },
  { name: "OpenSSL", license: "Apache-2.0" },
  { name: "BoringTun (WireGuard)", license: "BSD-3-Clause" },
  { name: "Kyber reference implementation", license: "Public Domain (CC0)" },
  { name: "React", license: "MIT" },
  { name: "lucide-react", license: "ISC" },
  { name: "TailwindCSS", license: "MIT" },
  { name: "tokio (Rust async runtime)", license: "MIT" },
  { name: "FastAPI", license: "MIT" },
  { name: "Argon2", license: "Apache-2.0 / CC0" },
];

export default function LicensesPage() {
  return (
    <PageShell
      eyebrow="Legal · Open-Source Licenses"
      icon={Scale}
      title={
        <>
          ECHO stands on the{" "}
          <span className="echo-gradient-text">shoulders of giants.</span>
        </>
      }
      subtitle="A complete map of every license, every dependency, every contributor we owe."
    >
      <section>
        <h2 className="text-2xl font-semibold tracking-tight">
          ECHO components
        </h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-[#a8a8b8] uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3">Component</th>
                <th className="px-5 py-3">License</th>
                <th className="px-5 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {ECHO_LICENSES.map((l, i) => (
                <tr
                  key={l.name}
                  className={i % 2 ? "bg-white/[0.02]" : ""}
                >
                  <td className="px-5 py-4">{l.name}</td>
                  <td className="px-5 py-4 font-mono text-[#c4a8ff]">
                    {l.license}
                  </td>
                  <td className="px-5 py-4">
                    <a
                      href={`https://${l.repo}`}
                      className="inline-flex items-center gap-1 text-[#e9d5ff] hover:underline"
                    >
                      {l.repo} <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">
          Third-party libraries we love
        </h2>
        <p className="mt-2 text-[#b9b9c4] max-w-2xl">
          A non-exhaustive selection. Full SBOM published with every release.
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THIRD_PARTY.map((d) => (
            <div
              key={d.name}
              className="glass rounded-xl px-4 py-3 flex items-center justify-between"
            >
              <span className="text-sm">{d.name}</span>
              <span className="font-mono text-[11px] text-[#a8a8b8]">
                {d.license}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 glass cyber-border rounded-2xl p-8">
        <h2 className="text-xl font-semibold">Reproducible builds</h2>
        <p className="mt-2 text-sm text-[#cfcfdc]">
          Every release ships with a deterministic build manifest and an
          accompanying CycloneDX SBOM. You can rebuild the exact binary we
          shipped — and many of our community members do.
        </p>
        <a
          href="#"
          className="btn-ghost mt-5 inline-flex !py-2 text-sm"
        >
          Read the build manifesto →
        </a>
      </section>
    </PageShell>
  );
}