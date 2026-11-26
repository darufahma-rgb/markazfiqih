import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Menampilkan teks dari Admin Panel dengan format sederhana:
 *   **tebal**   → tebal
 *   *miring*    → miring
 *   - item      → daftar berpoin (baris diawali "- " atau "• ")
 *   baris kosong → paragraf baru
 *
 * Dirender sebagai elemen React biasa (bukan HTML mentah), jadi aman dari
 * kode berbahaya yang mungkin tertempel di teks.
 */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={`${keyPrefix}-b${i++}`} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`${keyPrefix}-i${i++}`}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function FormattedText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

  return (
    <div className={cn('space-y-3 leading-relaxed', className)}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => /^\s*[-•]\s+/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1">
              {lines.map((l, li) => (
                <li key={li}>{renderInline(l.replace(/^\s*[-•]\s+/, ''), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export const FORMAT_HINT = 'Format: **tebal**, *miring*, baris diawali "- " untuk daftar berpoin, baris kosong untuk paragraf baru.';
