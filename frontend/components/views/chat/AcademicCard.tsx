import { useState } from "react";
import { BookMarked, ChevronDown, ChevronUp, ExternalLink, FileText } from "lucide-react";

interface AcademicPaper {
  title: string;
  authors: string[];
  year: number | null;
  citation_count: number;
  pdf_url: string | null;
  semantic_url: string;
}

interface AcademicCardProps {
  data: AcademicPaper[];
}

export default function AcademicCard({ data }: AcademicCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!data || data.length === 0) return null;

  return (
    <div>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 group"
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-3 rounded-full bg-emerald-600" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Tài liệu nghiên cứu ({data.length})
          </span>
        </div>
        <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      {/* Collapsed preview: just a hint row */}
      {!expanded && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
          <BookMarked className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {data[0].title}
            {data.length > 1 && ` +${data.length - 1} more`}
          </span>
        </div>
      )}

      {/* Expanded paper list */}
      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {data.map((paper, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-slate-200 bg-white flex gap-3"
            >
              <div className="shrink-0 w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
              </div>

              <div className="flex-1 min-w-0">
                <a
                  href={paper.semantic_url || paper.pdf_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-slate-800 hover:text-indigo-600 transition-colors leading-snug line-clamp-2"
                >
                  {paper.title}
                </a>

                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  {paper.authors.length > 0 && (
                    <span className="text-[10px] text-slate-500">
                      {paper.authors.slice(0, 3).join(", ")}
                      {paper.authors.length > 3 && " et al."}
                    </span>
                  )}
                  {paper.year && (
                    <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {paper.year}
                    </span>
                  )}
                  {paper.citation_count > 0 && (
                    <span className="text-[10px] text-slate-500">
                      {paper.citation_count.toLocaleString()} citations
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-2 flex items-center gap-2">
                  {paper.pdf_url && (
                    <a
                      href={paper.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <FileText className="w-3 h-3" />
                      Tải PDF
                    </a>
                  )}
                  {paper.semantic_url && (
                    <a
                      href={paper.semantic_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Semantic Scholar
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
