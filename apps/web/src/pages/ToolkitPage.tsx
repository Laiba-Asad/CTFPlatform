import { useMemo, useState } from 'react';
import { Kicker, PageTitle, Panel } from '../components/ui';
import { cn } from '../lib/cn';
import { CONVERTERS, type Converter } from '../lib/toolkit';

const FALLBACK = CONVERTERS[0] as Converter;

/**
 * In-site decoder toolkit: Base64, hex, ROT13, URL and binary. Pure client-side,
 * no network, stores nothing, never contains a flag. One text box in, one out.
 */
export function ToolkitPage() {
  const [active, setActive] = useState(FALLBACK.key);
  const [input, setInput] = useState('');
  const converter = CONVERTERS.find((c) => c.key === active) ?? FALLBACK;

  const { output, error } = useMemo(() => {
    if (!input) return { output: '', error: null as string | null };
    try {
      return { output: converter.run(input), error: null as string | null };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Could not convert that.' };
    }
  }, [converter, input]);

  return (
    <>
      <PageTitle>Toolkit</PageTitle>
      <p className="mt-2 max-w-prose text-base text-ink/65">
        A few decoders that run entirely in your browser. Nothing you type here leaves this page.
      </p>

      <Panel className="mt-4">
        <Kicker as="h2">Converter</Kicker>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Converter">
          {CONVERTERS.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={c.key === active}
              onClick={() => setActive(c.key)}
              className={cn(
                'rounded-control border-[1.5px] px-3 py-1.5 font-label text-micro font-bold uppercase tracking-label transition-colors',
                c.key === active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink/70 hover:text-ink',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="tk-in" className="font-label text-micro font-bold uppercase tracking-label text-ink/65">Input</label>
            <textarea
              id="tk-in"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              rows={6}
              placeholder={converter.hint}
              className="mt-1.5 w-full resize-y rounded-control border-[1.5px] border-line bg-white px-3 py-2 font-mono text-sm text-ink outline-none focus:border-ink"
            />
          </div>
          <div>
            <label htmlFor="tk-out" className="font-label text-micro font-bold uppercase tracking-label text-ink/65">Output</label>
            <output
              id="tk-out"
              className={cn(
                'mt-1.5 block min-h-[9.5rem] w-full whitespace-pre-wrap break-all rounded-control border-[1.5px] px-3 py-2 font-mono text-sm',
                error ? 'border-line bg-bg text-ink/50' : 'border-line bg-bg text-ink',
              )}
            >
              {error ?? output}
            </output>
          </div>
        </div>
      </Panel>
    </>
  );
}
