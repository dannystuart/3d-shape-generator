import Link from "next/link";

/** A plain index of the dev routes, and a way to reach the editor by a client-side link. */
export default function CataloguePage() {
  return (
    <main className="min-h-screen bg-sg-ink p-8 text-[13px] text-sg-muted">
      <h1 className="mb-4 text-[11px] uppercase tracking-[0.16em] text-sg-faint">Catalogue</h1>
      <ul className="space-y-2">
        <li>
          <Link href="/" className="underline" data-to-editor>
            The editor
          </Link>
        </li>
        {["shapes", "materials", "environments", "effects"].map((kind) => (
          <li key={kind}>
            <Link href={`/catalogue/sheet?kind=${kind}`} className="underline">
              Every {kind}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
