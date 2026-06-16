import { ExternalLink, Play } from "lucide-react";

interface YouTubeVideo {
  title: string;
  video_id: string;
  thumbnail_url: string;
  channel_title: string;
  watch_url: string;
}

interface YouTubeCardProps {
  data: YouTubeVideo[];
}

export default function YouTubeCard({ data }: YouTubeCardProps) {
  if (!data || data.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1 h-3 rounded-full bg-red-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Video bài giảng
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {data.map((video) => (
          <a
            key={video.video_id}
            href={video.watch_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-slate-100 overflow-hidden">
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-slate-400" />
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 text-slate-800 fill-slate-800" />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-2.5 flex-1">
              <p className="text-xs font-medium text-slate-800 leading-snug line-clamp-2 mb-1">
                {video.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 truncate flex-1">
                  {video.channel_title}
                </span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
