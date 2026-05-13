import React from "react";
import PageShell from "@/components/layout/PageShell";

/**
 * Reusable legal document layout.
 * Renders a side TOC (sticky) + the document body with H2 anchors.
 */
export default function LegalPage({
  eyebrow,
  icon,
  title,
  subtitle,
  updatedAt,
  sections = [],
}) {
  return (
    <PageShell
      eyebrow={eyebrow}
      icon={icon}
      title={title}
      subtitle={subtitle}
    >
      <div className="text-center text-xs text-[#7a7a8a] -mt-4 mb-12">
        Last updated · <span className="font-mono">{updatedAt}</span>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-10">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-2 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-[#8a8a99]">
              On this page
            </div>
            {sections.map((s, i) => (
              <a
                key={s.heading}
                href={`#sec-${i}`}
                className="block text-[#cfcfdc] hover:text-white"
              >
                {i + 1}. {s.heading}
              </a>
            ))}
          </div>
        </aside>

        {/* Body */}
        <article className="glass cyber-border rounded-2xl p-7 sm:p-10">
          <div className="prose-echo space-y-12">
            {sections.map((s, i) => (
              <section id={`sec-${i}`} key={s.heading}>
                <h2 className="text-2xl font-semibold tracking-tight">
                  <span className="text-[#a855f7] mr-2 font-mono text-base">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.heading}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[#cfcfdc]">
                  {s.body.map((p, k) =>
                    typeof p === "string" ? (
                      <p key={k}>{p}</p>
                    ) : p.type === "list" ? (
                      <ul key={k} className="list-disc pl-5 space-y-1.5">
                        {p.items.map((it, idx) => (
                          <li key={idx}>{it}</li>
                        ))}
                      </ul>
                    ) : null,
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </PageShell>
  );
}