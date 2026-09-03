import React, { useState } from 'react';
import { Activity, Zap, Cpu, Terminal, AlertTriangle, Info, Trash2, CheckCircle2 } from 'lucide-react';

export interface ActivityItem {
  id: string;
  kind: 'forge' | 'build' | 'agent' | 'error' | 'system';
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
  timestamp: number;
}

interface ActivityViewProps {
  activity: ActivityItem[];
  onClearActivity: () => void;
}

export function ActivityView({ activity, onClearActivity }: ActivityViewProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredActivity = activity.filter((item) => {
    if (filter === 'all') return true;
    return item.kind === filter;
  });

  const getKindIcon = (kind: ActivityItem['kind']) => {
    switch (kind) {
      case 'forge':
        return <Zap className="w-4 h-4 text-[#ff7a1a]" />;
      case 'build':
        return <Cpu className="w-4 h-4 text-[#ffb347]" />;
      case 'agent':
        return <Terminal className="w-4 h-4 text-[#57c08a]" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-[#d64541]" />;
      default:
        return <Info className="w-4 h-4 text-[#8a9bb0]" />;
    }
  };

  const getSeverityBadge = (severity: ActivityItem['severity']) => {
    switch (severity) {
      case 'success':
        return 'bg-[#57c08a]/15 text-[#57c08a] border-[#57c08a]/30';
      case 'warning':
        return 'bg-[#e0a33d]/15 text-[#e0a33d] border-[#e0a33d]/30';
      case 'error':
        return 'bg-[#d64541]/15 text-[#d64541] border-[#d64541]/30';
      default:
        return 'bg-[#8a9bb0]/15 text-[#8a9bb0] border-[#8a9bb0]/30';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#352d28]">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-medieval tracking-wide text-[#e8dcc8] flex items-center gap-3">
            <span className="text-[#ff7a1a]">Forge Activity</span>
            <span className="text-xs px-2.5 py-1 rounded bg-[#282220] text-[#ffb347] font-sans font-medium border border-[#352d28]">
              {activity.length} Entries
            </span>
          </h1>
          <p className="text-sm text-[#a99c88] mt-1">
            Audit trail of forge sessions, build runner executions, and agent operations
          </p>
        </div>

        <button
          type="button"
          onClick={onClearActivity}
          disabled={activity.length === 0}
          className="px-3.5 py-1.5 rounded-lg bg-[#282220] hover:bg-[#352d28] border border-[#352d28] text-xs font-medium text-[#a99c88] hover:text-[#e8dcc8] transition-colors flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Activity</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        {['all', 'forge', 'build', 'agent', 'error', 'system'].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
              filter === cat
                ? 'bg-[#ff7a1a] text-[#161210] font-bold'
                : 'bg-[#161210] text-[#a99c88] hover:bg-[#1f1a17] border border-[#2a2320]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid: Feed and Operation Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-7 space-y-3">
          {filteredActivity.length === 0 ? (
            <div className="bg-[#161210] rounded-xl border border-[#352d28] p-10 text-center space-y-3">
              <Activity className="w-10 h-10 text-[#6f6558] mx-auto" />
              <div className="text-base font-semibold text-[#e8dcc8]">The forge has been quiet.</div>
              <p className="text-xs text-[#6f6558] max-w-sm mx-auto">
                Forge activity, builds, and agent operations appear here as sessions execute.
              </p>
            </div>
          ) : (
            filteredActivity.map((item) => (
              <div
                key={item.id}
                className="bg-[#161210] rounded-xl border border-[#352d28] p-4 space-y-2 hover:border-[#ff7a1a]/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded bg-[#1f1a17] border border-[#2a2320]">
                      {getKindIcon(item.kind)}
                    </div>
                    <span className="text-sm font-semibold text-[#e8dcc8]">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded border ${getSeverityBadge(
                        item.severity
                      )}`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-[11px] font-mono text-[#6f6558]">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {item.body && (
                  <p className="text-xs text-[#a99c88] font-mono bg-[#1f1a17] p-2.5 rounded-lg border border-[#2a2320] leading-relaxed whitespace-pre-wrap">
                    {item.body}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Operation Raw Stream */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-[#161210] rounded-xl border border-[#352d28] p-5 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a99c88] font-mono flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#ff7a1a]" />
              Operation Raw Log
            </h2>

            <div className="bg-[#0b0806] rounded-lg p-3.5 border border-[#2a2320] h-96 overflow-y-auto font-mono text-[11px] space-y-1.5">
              {activity.map((item, idx) => (
                <div key={idx} className="text-[#a99c88] leading-tight flex items-start gap-1.5">
                  <span className="text-[#6f6558] select-none">
                    [{new Date(item.timestamp).toLocaleTimeString([], { hour12: false })}]
                  </span>
                  <span className={item.severity === 'error' ? 'text-[#d64541]' : item.severity === 'success' ? 'text-[#57c08a]' : 'text-[#e8dcc8]'}>
                    {item.title} {item.body ? `— ${item.body}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
