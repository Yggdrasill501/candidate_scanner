import type { Doc } from "@/lib/content";

/** Paragraphs, with consecutive "• " lines grouped into one list. */
function Body({ lines }: { lines: string[] }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      out.push(
        <ul key={out.length}>
          {list.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const line of lines) {
    if (line.startsWith("• ")) list.push(line.slice(2));
    else {
      flush();
      out.push(<p key={out.length}>{line}</p>);
    }
  }
  flush();
  return out;
}

/** A reading page: contents beside a 70ch text column. */
export function Prose({
  doc,
  children,
}: {
  doc: Doc;
  children?: React.ReactNode;
}) {
  return (
    <div className="read">
      <nav className="toc" aria-label={doc.title}>
        {doc.sections.map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.h}
          </a>
        ))}
      </nav>
      <article className="prose">
        {doc.sections.map((s) => (
          <section key={s.id} id={s.id}>
            <h2>{s.h}</h2>
            <Body lines={s.body} />
          </section>
        ))}
        {children}
      </article>
    </div>
  );
}
