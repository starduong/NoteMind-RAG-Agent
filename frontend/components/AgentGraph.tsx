import React from "react";
import { 
  Search, 
  FileText, 
  ShieldAlert, 
  PenTool, 
  Check, 
  Loader2, 
  AlertCircle 
} from "lucide-react";

type AgentStatus = "idle" | "running" | "success" | "skipped";

interface AgentGraphProps {
  workflowLog: string[];
  isProcessing: boolean;
}

interface NodeData {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  status: AgentStatus;
  details?: string;
}

export default function AgentGraph({ workflowLog, isProcessing }: AgentGraphProps) {
  // Parse logs to determine status of each agent
  const getAgentStatuses = (): Record<string, { status: AgentStatus; details: string }> => {
    const statuses: Record<string, { status: AgentStatus; details: string }> = {
      research: { status: "idle", details: "Waiting to start..." },
      summarize: { status: "idle", details: "Waiting for research..." },
      critic: { status: "idle", details: "Waiting for draft..." },
      editor: { status: "idle", details: "Waiting for critique..." },
    };

    if (!isProcessing && workflowLog.length === 0) {
      return statuses;
    }

    // Process logs sequentially
    workflowLog.forEach((log) => {
      // Research Agent checks
      if (log.includes("[Research] Researcher: searching")) {
        statuses.research = { status: "running", details: "Searching sources & FAISS indices..." };
      } else if (log.includes("Researcher: found")) {
        const chunkMatch = log.match(/found (\d+) chunks/);
        const count = chunkMatch ? chunkMatch[1] : "";
        statuses.research = { status: "success", details: `Retrieved ${count} context chunks` };
      }

      // Summarizer checks
      if (log.includes("Summarizer: drafting report")) {
        statuses.research = { status: "success", details: "Research complete" };
        statuses.summarize = { status: "running", details: "Synthesizing research into a report..." };
      } else if (log.includes("Summarizer: draft complete")) {
        statuses.summarize = { status: "success", details: "Initial draft generated" };
      }

      // Critic checks
      if (log.includes("Critic: evaluating quality")) {
        statuses.summarize = { status: "success", details: "Draft generated" };
        statuses.critic = { status: "running", details: "Reviewing draft for information gaps..." };
      } else if (log.includes("Critic: skipped")) {
        statuses.critic = { status: "skipped", details: "Skipped (Direct draft accepted)" };
      } else if (log.includes("Critic: gaps=")) {
        const gapMatch = log.includes("gaps=True");
        statuses.critic = { 
          status: "success", 
          details: gapMatch ? "Quality check complete: Found gaps to address" : "Quality check complete: No gaps found" 
        };
      }

      // Editor checks
      if (log.includes("Editor: polishing report")) {
        statuses.critic = { 
          status: statuses.critic.status === "idle" || statuses.critic.status === "running" 
            ? "success" 
            : statuses.critic.status,
          details: statuses.critic.details
        };
        statuses.editor = { status: "running", details: "Refining formatting and vocabulary..." };
      } else if (log.includes("Editor: complete")) {
        statuses.editor = { status: "success", details: "Final output polished" };
      } else if (log.includes("Editor: skipped")) {
        statuses.editor = { status: "skipped", details: "Draft approved without edits" };
      }
    });

    // If processing has stopped but we have logs, set running to success
    if (!isProcessing && workflowLog.length > 0) {
      if (statuses.research.status === "running") statuses.research.status = "success";
      if (statuses.summarize.status === "running") statuses.summarize.status = "success";
      if (statuses.critic.status === "running") statuses.critic.status = "success";
      if (statuses.editor.status === "running") statuses.editor.status = "success";
    }

    // Default running state if empty log but isProcessing
    if (isProcessing && workflowLog.length === 0) {
      statuses.research = { status: "running", details: "Initializing agent pipeline..." };
    }

    return statuses;
  };

  const agentStates = getAgentStatuses();

  const nodes: NodeData[] = [
    {
      id: "research",
      name: "Research Agent",
      description: "Document Retrieval & FAISS Search",
      icon: Search,
      status: agentStates.research.status,
      details: agentStates.research.details,
    },
    {
      id: "summarize",
      name: "Summarizer Agent",
      description: "Synthesis & Context Aggregation",
      icon: FileText,
      status: agentStates.summarize.status,
      details: agentStates.summarize.details,
    },
    {
      id: "critic",
      name: "Critic Agent",
      description: "Gap Identification & Verification",
      icon: ShieldAlert,
      status: agentStates.critic.status,
      details: agentStates.critic.details,
    },
    {
      id: "editor",
      name: "Editor Agent",
      description: "Formatting & Tone Polishing",
      icon: PenTool,
      status: agentStates.editor.status,
      details: agentStates.editor.details,
    },
  ];

  // Helper to render node icon container styles
  const getNodeStyles = (status: AgentStatus) => {
    switch (status) {
      case "running":
        return "bg-indigo-50 border-indigo-400 text-indigo-600";
      case "success":
        return "bg-white border-indigo-300 text-indigo-600";
      case "skipped":
        return "bg-slate-100 border-slate-300 text-slate-500";
      case "idle":
      default:
        return "bg-white border-slate-300 text-slate-500";
    }
  };

  const getLineStroke = (fromStatus: AgentStatus, toStatus: AgentStatus) => {
    if (fromStatus === "success" && toStatus === "running") {
      return "url(#grad-pulse)";
    }
    if (fromStatus === "success" && (toStatus === "success" || toStatus === "skipped")) {
      return "#6366F1";
    }
    if (fromStatus === "success" && toStatus === "idle") {
      return "#94A3B8";
    }
    return "#CBD5E1";
  };

  return (
    <div className="flex flex-col h-full p-4 select-none bg-slate-50">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Multi-Agent Graph
        </h3>
        <p className="text-xs text-slate-600 mt-1">
          Visualizing the LangGraph sequential decision pipeline in real-time.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-between relative py-6 min-h-[360px]">
        {/* SVG Connector Lines */}
        <div className="absolute left-[34px] top-[40px] bottom-[40px] w-[2px] z-0 pointer-events-none">
          <svg className="h-full w-full overflow-visible">
            <defs>
              <linearGradient id="grad-pulse" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="55%" stopColor="#6366F1" />
                <stop offset="100%" stopColor="#CBD5E1" />
              </linearGradient>
            </defs>
            {/* Line 1: Research -> Summarize */}
            <path
              d="M 0 0 L 0 95"
              fill="none"
              stroke={getLineStroke(nodes[0].status, nodes[1].status)}
              strokeWidth="2.25"
              className={nodes[0].status === "success" && nodes[1].status === "running" ? "animate-dash" : ""}
              style={{ strokeDasharray: "7 5" }}
            />
            {/* Line 2: Summarize -> Critic */}
            <path
              d="M 0 95 L 0 190"
              fill="none"
              stroke={getLineStroke(nodes[1].status, nodes[2].status)}
              strokeWidth="2.25"
              className={nodes[1].status === "success" && nodes[2].status === "running" ? "animate-dash" : ""}
              style={{ strokeDasharray: "7 5" }}
            />
            {/* Line 3: Critic -> Editor */}
            <path
              d="M 0 190 L 0 285"
              fill="none"
              stroke={getLineStroke(nodes[2].status, nodes[3].status)}
              strokeWidth="2.25"
              className={nodes[2].status === "success" && nodes[3].status === "running" ? "animate-dash" : ""}
              style={{ strokeDasharray: "7 5" }}
            />
          </svg>
        </div>

        {/* Nodes */}
        {nodes.map((node, index) => {
          const Icon = node.icon;
          return (
            <div key={node.id} className="flex items-start gap-4 relative z-10 my-2 group">
              {/* Node Icon Circle */}
              <div
                className={`w-[40px] h-[40px] rounded-full border flex items-center justify-center transition-all duration-300 ${getNodeStyles(
                  node.status
                )}`}
              >
                {node.status === "success" ? (
                  <Check className="w-4 h-4 text-indigo-600" />
                ) : node.status === "running" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : node.status === "skipped" ? (
                  <AlertCircle className="w-4 h-4 text-slate-500" />
                ) : (
                  <Icon className="w-4 h-4 opacity-70" />
                )}
              </div>

              {/* Node Text Content */}
              <div className="flex-1 bg-white border border-slate-200 p-2.5 rounded-lg transition-all duration-200 group-hover:border-indigo-200">
                <div className="flex items-center justify-between">
                  <h4 className={`text-xs font-semibold ${node.status === "idle" ? "text-slate-500" : "text-slate-900"}`}>
                    {node.name}
                  </h4>
                  {node.status !== "idle" && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                        node.status === "running"
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                          : node.status === "success"
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-100"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {node.status}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-600 leading-tight mt-0.5">
                  {node.description}
                </p>
                {node.status !== "idle" && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-slate-600 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="truncate max-w-[200px]" title={node.details}>
                      {node.details}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-600 flex items-start gap-2">
        <span className="text-indigo-600">💡</span>
        <p className="leading-normal">
          LangGraph guarantees high quality responses by routing the context through critics and editors dynamically. Skipped statuses occur if a draft already satisfies constraints.
        </p>
      </div>
    </div>
  );
}
