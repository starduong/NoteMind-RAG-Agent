import { ExternalLink, BookOpen } from "lucide-react";

interface WikiResult {
  title: string;
  summary: string;
  url: string;
  status: "success" | "not_found" | "error";
}

interface WikiCardProps {
  data: WikiResult;
}

export default function WikiCard({ data }: WikiCardProps) {
  if (!data || data.status !== "success" || !data.summary) return null;

  return (
    <div className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
        <BookOpen className="w-4 h-4 text-blue-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            Wikipedia
          </span>
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-500 hover:text-blue-600 flex items-center gap-0.5 transition-colors"
            >
              Đọc thêm
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
        <p className="text-xs font-semibold text-slate-800 mb-0.5">{data.title}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{data.summary}</p>
      </div>
    </div>
  );
}
