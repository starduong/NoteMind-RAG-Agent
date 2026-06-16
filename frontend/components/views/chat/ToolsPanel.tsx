import WikiCard from "./WikiCard";
import YouTubeCard from "./YouTubeCard";
import GitHubCard from "./GitHubCard";
import AcademicCard from "./AcademicCard";

interface WikiResult {
  title: string;
  summary: string;
  url: string;
  status: "success" | "not_found" | "error";
}

interface YouTubeVideo {
  title: string;
  video_id: string;
  thumbnail_url: string;
  channel_title: string;
  watch_url: string;
}

interface GitHubRepo {
  full_name: string;
  stars: number;
  language: string | null;
  description: string;
  url: string;
}

interface AcademicPaper {
  title: string;
  authors: string[];
  year: number | null;
  citation_count: number;
  pdf_url: string | null;
  semantic_url: string;
}

export interface ToolsData {
  wikipedia?: WikiResult | null;
  youtube?: YouTubeVideo[] | null;
  github?: GitHubRepo[] | null;
  academic?: AcademicPaper[] | null;
}

interface ToolsPanelProps {
  toolsData: ToolsData | null | undefined;
}

export default function ToolsPanel({ toolsData }: ToolsPanelProps) {
  if (!toolsData) return null;

  const hasWiki = toolsData.wikipedia?.status === "success" && toolsData.wikipedia?.summary;
  const hasYoutube = (toolsData.youtube?.length ?? 0) > 0;
  const hasGithub = (toolsData.github?.length ?? 0) > 0;
  const hasAcademic = (toolsData.academic?.length ?? 0) > 0;

  if (!hasWiki && !hasYoutube && !hasGithub && !hasAcademic) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-3">
      {hasWiki && <WikiCard data={toolsData.wikipedia!} />}
      {hasYoutube && <YouTubeCard data={toolsData.youtube!} />}
      {hasGithub && <GitHubCard data={toolsData.github!} />}
      {hasAcademic && <AcademicCard data={toolsData.academic!} />}
    </div>
  );
}
