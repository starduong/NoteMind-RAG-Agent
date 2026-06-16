import { Star, ExternalLink, Code2 } from "lucide-react";

interface GitHubRepo {
  full_name: string;
  stars: number;
  language: string | null;
  description: string;
  url: string;
}

interface GitHubCardProps {
  data: GitHubRepo[];
}

const LANG_COLORS: Record<string, string> = {
  Python: "bg-blue-100 text-blue-700",
  JavaScript: "bg-yellow-100 text-yellow-700",
  TypeScript: "bg-sky-100 text-sky-700",
  Java: "bg-orange-100 text-orange-700",
  "C++": "bg-pink-100 text-pink-700",
  C: "bg-gray-100 text-gray-700",
  Go: "bg-cyan-100 text-cyan-700",
  Rust: "bg-amber-100 text-amber-700",
  R: "bg-indigo-100 text-indigo-700",
  Julia: "bg-purple-100 text-purple-700",
};

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function GitHubCard({ data }: GitHubCardProps) {
  if (!data || data.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1 h-3 rounded-full bg-slate-700" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          GitHub Repositories
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {data.map((repo) => {
          const langClass = repo.language
            ? (LANG_COLORS[repo.language] ?? "bg-slate-100 text-slate-600")
            : null;

          return (
            <a
              key={repo.url}
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="shrink-0 w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                <Code2 className="w-3.5 h-3.5 text-slate-600" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-800 font-mono group-hover:text-indigo-600 transition-colors truncate">
                    {repo.full_name}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium shrink-0">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    {formatStars(repo.stars)}
                  </span>
                  {langClass && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${langClass}`}>
                      {repo.language}
                    </span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                    {repo.description}
                  </p>
                )}
              </div>

              <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
