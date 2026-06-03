import { Newspaper, Clock } from "lucide-react";
import PageShell from "@/components/layout/PageShell";

export default function BlogWhatIsEcho() {
  return (
    <PageShell
      eyebrow="Company · Blog"
      icon={Newspaper}
      title={
        <>
          Echo: mensajería donde <br className="hidden sm:block" />
          <span className="echo-gradient-text">ni nosotros podemos leer tus mensajes</span>
        </>
      }
      subtitle="Cómo combinamos protocolos asíncronos y diseños de árbol para lograr E2EE, sincronización multidispositivo y escalado de grupos."
    >
      <article className="glass cyber-border rounded-2xl p-8 sm:p-10 prose prose-invert max-w-none">
        <div className="flex items-center gap-3 text-sm text-[#a0a0a0] mb-2">
          <Clock className="h-4 w-4" /> <span>Equipo Echo · Jun 2026 · 12 min</span>
        </div>

        <h2>Introducción</h2>
        <p className="mb-6">
          El cifrado de extremo a extremo (E2EE) es la columna vertebral de la privacidad en mensajería moderna:
          asegura que solo los participantes de una conversación puedan leer su contenido. Sin embargo, lograr
          E2EE real va más allá de elegir una librería de cifrado: exige coordinar protocolos para inicio de sesión
          asíncrono, ratcheo por mensaje, soporte multidispositivo y escalado eficiente en chats de grupo.
        </p>

        <h3>Resumen rápido</h3>
        <p className="mb-6">
          En Echo combinamos tres bloques complementarios: X3DH para iniciar sesiones con usuarios offline,
          Double Ratchet para generar claves por mensaje (garantizando forward secrecy y post-compromise security)
          y MLS/TreeKEM para que los grupos grandes funcionen con coste logarítmico. A continuación explicamos
          cada pieza y cómo encajan para que nuestro servidor quede «matemáticamente incapaz» de leer mensajes.
        </p>

        <h2>X3DH: iniciar conversaciones aunque el receptor esté desconectado</h2>
        <p className="mb-6">
          X3DH (Extended Triple Diffie-Hellman) es un protocolo de establecimiento de claves diseñado para el
          entorno de mensajería: permite que Alice calcule un secreto compartido con Bob usando un conjunto de
          claves que Bob ha publicado en el servidor (identidad, signed prekey y opcionales one-time prekeys).
          Esto elimina la necesidad de que Bob esté online en el momento del primer mensaje.
        </p>
        <p className="mb-6">
          La fortaleza de X3DH reside en combinar varios DH entre pares de claves (identidad↔efímera, prekey↔efímera,
          etc.) para obtener autenticación y forward secrecy. Además, el uso de one-time prekeys mejora la protección
          contra reconstrucción de sesiones antiguas si se filtran claves de largo plazo.
        </p>

        <h2>Double Ratchet: una clave única por mensaje</h2>
        <p className="mb-6">
          Tras el establecimiento inicial, el Double Ratchet se encarga de derivar claves por mensaje mediante dos
          mecanismos: una cadena simétrica que avanza por cada mensaje enviado (KDF chains) y un ratchet DH que rota
          material secreto periódicamente. Esta combinación ofrece dos garantías fundamentales:
        </p>
        <ul className="mb-6">
          <li className="mb-2">
            <strong>Forward Secrecy (FS):</strong> comprometer claves actuales no permite recuperar claves pasadas.
          </li>
          <li>
            <strong>Post-Compromise Security (PCS):</strong> tras una ruptura, nuevas rotaciones DH permiten recuperar la seguridad
            frente al atacante que tenía acceso previo.
          </li>
        </ul>

        <h2>Grupos escalables: MLS y TreeKEM</h2>
        <p className="mb-6">
          El cifrado punto a punto para cada miembro en un grupo resulta ineficiente cuando el número de participantes
          crece. Messaging Layer Security (MLS) propone un enfoque con una estructura de árbol (TreeKEM) que permite
          derivar claves de forma logarítmica respecto al tamaño del grupo. Al cambiar la membresía o rotar claves,
          solo es necesario reencriptar información hacia nodos concretos del árbol, reduciendo el ancho de banda y el
          coste computacional.
        </p>

        <h2>Sincronización multidispositivo</h2>
        <p className="mb-6">
          Soportar varios dispositivos por usuario sin comprometer secretos exige protocolos de incorporación seguros:
          cada dispositivo tiene su propio par de claves; la incorporación se realiza mediante handshakes cifrados y
          verificaciones (por ejemplo SAS) entre dispositivos. Los estados se sincronizan cifrando datos con claves que
          solo los dispositivos autorizados pueden derivar, evitando que el servidor obtenga material de sesión.
        </p>

        <h2>Consideraciones prácticas y trade-offs</h2>
        <p className="mb-6">
          Las propiedades criptográficas son necesarias pero no suficientes: la seguridad real depende de detalles de
          implementación, gestión de errores, y del manejo de metadatos. Algunos puntos a considerar:
        </p>
        <ul className="mb-6">
          <li className="mb-2">Manejo de mensajes perdidos y reorder: necesitamos almacenamiento temporal y mecanismos para recuperar claves.</li>
          <li className="mb-2">Metadatos: quién habla con quién y cuándo sigue siendo visible para el servidor a menos que se apliquen contramedidas específicas.</li>
          <li>Recuperación de cuenta: ofrecer opciones de recuperación exige diseñar garantías que no debiliten las claves.</li>
        </ul>

        <h2>Mirando al futuro: híbridos post-cuánticos</h2>
        <p className="mb-6">
          Para anticipar amenazas cuánticas, la dirección práctica es el cruce híbrido: mezclar KEMs post-cuánticos con
          los esquemas actuales y derivar claves combinadas. Así se mantiene compatibilidad con el ecosistema actual
          mientras se gana resiliencia frente a ataques futuros.
        </p>

        <h2>Conclusión</h2>
        <p className="mb-6">
          En Echo hemos diseñado la pila de mensajería para minimizar la confianza en el servidor mediante la combinación
          de X3DH, Double Ratchet y MLS/TreeKEM. El resultado es una experiencia que permite enviar mensajes a contactos
          offline, sincronizar múltiples dispositivos y escalar a grupos grandes —todo ello sin que el servidor pueda
          descifrar el contenido.
        </p>

        <div className="mt-8 text-sm text-[#9b9b9b]">
          <h4 className="mb-2">Fuentes</h4>
          <ul className="list-disc list-inside">
            <li className="mb-1">
              <a href="https://signal.org/docs/specifications/x3dh/" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline">X3DH — Signal Protocol (especificación)</a>
            </li>
            <li className="mb-1">
              <a href="https://signal.org/docs/specifications/doubleratchet/" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline">Double Ratchet — Signal Protocol (especificación)</a>
            </li>
            <li>
              <a href="https://datatracker.ietf.org/doc/html/rfc9420" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline">RFC 9420 — Messaging Layer Security (MLS)</a>
            </li>
          </ul>
        </div>
      </article>
    </PageShell>
  );
}
