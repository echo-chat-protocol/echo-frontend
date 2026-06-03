import { Newspaper, Clock, ArrowUpRight } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

const POSTS = [
  {
    slug: "what-is-echo",
    tag: "Privacidad",
    title: "Echo: mensajería donde ni nosotros podemos leer tus mensajes",
    desc: "Cómo combinamos X3DH, Double Ratchet y MLS-TreeKEM para ofrecer E2EE, sincronización multidispositivo y grupos escalables.",
    author: "Equipo Echo",
    date: "Jun 2026",
    read: "8 min",
    accent: "from-[#7c3aed] to-[#a855f7]",
  },
  {
    slug: "double-ratchet-explicado",
    tag: "Criptografía",
    title: "Double Ratchet en español: por qué cada mensaje tiene su propia clave",
    desc: "La mayoría de apps cifran con una clave de sesión. Double Ratchet genera una clave nueva por mensaje, de forma que comprometer un mensaje no revela ningún otro.",
    author: "Miguel Mascaró",
    date: "May 2026",
    read: "6 min",
    accent: "from-[#6d28d9] to-[#8b5cf6]",
    image: "cryptography.jpeg",
  },
  {
    slug: "x3dh-sin-conexion",
    tag: "Protocolo",
    title: "X3DH: cómo iniciar una conversación cifrada con alguien offline",
    desc: "Extended Triple Diffie-Hellman permite que Alice establezca un secreto compartido con Bob aunque Bob esté desconectado. Sin magia, solo matemáticas.",
    author: "Marcos Cabrero",
    date: "May 2026",
    read: "7 min",
    accent: "from-[#7c3aed] to-[#c4a8ff]",
    image: "X3DH.png",
  },
  {
    slug: "grupos-mls-treekem",
    tag: "Grupos",
    title: "Grupos E2EE escalables: cómo MLS-TreeKEM mantiene el coste logarítmico",
    desc: "Cifrar para 1 024 personas podría costar O(n). Con un árbol de claves cuesta O(log n). Así funciona el sistema de grupos de Echo.",
    author: "Nicolás Pertierra",
    date: "Abr 2026",
    read: "10 min",
    accent: "from-[#4c1d95] to-[#7c3aed]",
    image: "dh.png",
  },
  {
    slug: "servidor-ciego",
    tag: "Privacidad",
    title: "Servidor honesto pero curioso: por qué Echo no necesita confiar en sí mismo",
    desc: "Nuestro modelo de amenaza asume que el servidor puede ver todo el tráfico cifrado. El protocolo está diseñado para que eso no importe.",
    author: "Gonzalo de la Lastra",
    date: "Abr 2026",
    read: "5 min",
    accent: "from-[#5b21b6] to-[#a855f7]",
    image: "office.jpg",
  },
  {
    slug: "multidispositivo-seguro",
    tag: "Ingeniería",
    title: "Sincronización multidispositivo sin ceder tus claves privadas",
    desc: "Añadir un segundo dispositivo a tu cuenta parece sencillo. Hacerlo sin que el servidor vea tus secretos requiere un handshake en dos fases con verificación SAS.",
    author: "Miguel Mascaró",
    date: "Mar 2026",
    read: "9 min",
    accent: "from-[#7c3aed] to-[#6d28d9]",
  },
];

export default function BlogPage() {
  const [hero, ...rest] = POSTS;

  // Control image loading strategy:
  // - Set `window.ECHO_PRELOAD_IMAGES = true` in the browser console or
  // - Add `?preload_images=1` to the URL to force eager loading (preload)
  // Otherwise images will use native lazy loading to improve performance.
  let preloadImages = false;
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      preloadImages = Boolean(window.ECHO_PRELOAD_IMAGES) || params.get("preload_images") === "1";
    } catch {
      // ignore
    }
  }

  const loadingAttr = preloadImages ? "eager" : "lazy";
  return (
    <PageShell
      eyebrow="Company · Blog"
      icon={Newspaper}
      title={
        <>
          Field notes from the{" "}
          <span className="echo-gradient-text">privacy frontier.</span>
        </>
      }
      subtitle="Engineering deep dives, transparency reports and the occasional rant about ad-driven UX."
    >
      {/* Featured */}
      <article className="glass cyber-border rounded-3xl overflow-hidden">
        <div className="grid lg:grid-cols-2">
          <div
            className={`relative min-h-[260px] bg-black flex items-center justify-center`}
          >
            <img src="/echo-logo.svg" alt="Echo" loading={loadingAttr} decoding="async" className="h-48 w-48 sm:h-56 sm:w-56 object-contain opacity-95" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 font-mono text-[11px] uppercase tracking-wider text-white/80">
              Featured · {hero.tag}
            </div>
          </div>
          <div className="p-8 sm:p-10 flex flex-col">
            <h2 className="text-3xl font-semibold tracking-tight leading-tight">
              {hero.title}
            </h2>
            <p className="mt-4 text-[#b9b9c4]">{hero.desc}</p>
            <div className="mt-auto pt-8 flex items-center justify-between text-xs text-[#a0a0a0]">
              <span>
                {hero.author} · {hero.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {hero.read}
              </span>
            </div>
            <a
              href="/blog/what-is-echo"
              className="mt-5 inline-flex items-center gap-1.5 text-[#e9d5ff]"
            >
              Leer artículo <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </article>

      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
        {rest.map((p) => (
          <article
            key={p.title}
            className="glass cyber-border rounded-2xl overflow-hidden flex flex-col"
          >
            <div className="h-32 relative">
              {p.image ? (
                <>
                  <img src={`/blog/${p.image}`} alt={p.title} loading={loadingAttr} decoding="async" className="object-cover object-center w-full h-full rounded-t-2xl block" />
                  <div className="absolute inset-0 bg-black/30 rounded-t-2xl" />
                </>
              ) : (
                <div className={`h-32 bg-gradient-to-br ${p.accent} relative`} />
              )}
              <span className="absolute top-3 left-3 rounded-full bg-black/40 backdrop-blur px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
                {p.tag}
              </span>
            </div>
            <div className="p-6 flex flex-col flex-1">
              <h3 className="text-lg font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-sm text-[#a8a8b8] flex-1">{p.desc}</p>
              <div className="mt-5 flex items-center justify-between text-xs text-[#a0a0a0]">
                <span>
                  {p.author} · {p.date}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {p.read}
                </span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </PageShell>
  );
}