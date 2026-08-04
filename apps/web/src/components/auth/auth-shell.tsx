import Image from "next/image";
import Link from "next/link";

export function AuthShell({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <main className="relative grid min-h-svh overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,oklch(0.72_0.19_250_/_0.15),transparent_36%)]" />
      <section className="relative hidden items-center justify-center border-r border-white/10 p-12 lg:flex">
        <Link className="text-center" aria-label="Synk home" href="/">
          <Image
            alt=""
            className="brand-neon-blue mx-auto size-56 rounded-[2.5rem]"
            height={420}
            priority
            src="/logo.png"
            width={420}
          />
          <p className="mt-8 text-6xl font-semibold tracking-[-0.06em]">Synk</p>
          <p className="mt-3 text-sm tracking-[0.2em] text-blue-100/60 uppercase">
            Find time. Together.
          </p>
        </Link>
      </section>

      <section className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link className="mb-8 flex justify-center lg:hidden" href="/">
            <Image
              alt="Synk"
              className="brand-neon-blue size-20 rounded-2xl"
              height={112}
              priority
              src="/logo.png"
              width={112}
            />
          </Link>
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Organizer access
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
