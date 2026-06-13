import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from "../config";

function ChatView({ datasetId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || !datasetId) return;

        const userMsg = { role: 'user', content: input };
        const updatedMessages = [...messages, userMsg];

        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataset_id: datasetId,
                    query: input,
                    // Pass history so backend has conversational context.
                    // Content can be a string (user) or {answer, table} (assistant).
                    // Backend's format_history() handles both shapes.
                    history: updatedMessages,
                }),
            });

            if (!res.ok) throw new Error(`Server responded with ${res.status}`);

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data }]);

        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: { answer: 'Failed to connect to chat server.', table: null } }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full">

            {/* CHAT AREA */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                        {datasetId ? "Ask anything about your dataset..." : "Upload a dataset first to start chatting."}
                    </div>
                )}

                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                            <div className="text-white bg-blue-600/50 px-4 py-2 rounded-2xl max-w-[80%]">
                                {msg.content}
                            </div>
                        ) : (
                            <div className="text-slate-200 bg-white/5 px-4 py-3 rounded-2xl max-w-[90%] border border-white/10 space-y-3">
                                <BotMessage content={msg.content} />
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl text-slate-400 text-sm animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* INPUT */}
            <div className="p-4 flex gap-3 border-t border-white/10 bg-[#0b0f19]">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={datasetId ? "Ask about your data..." : "Please upload a dataset first..."}
                    disabled={!datasetId || loading}
                    className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !datasetId || !input.trim()}
                    className="px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {loading ? '...' : 'Send'}
                </button>
            </div>
        </div>
    );
}

function BotMessage({ content }) {
    if (content?.error && !content?.answer) {
        return <p className="text-red-400 font-medium">⚠️ {content.error}</p>;
    }

    const { answer, table, error } = content;

    // ── Check if this is a structured summary report ──────────────────────
    if (answer && typeof answer === "string") {
        try {
            const parsed = JSON.parse(answer);
            if (parsed?.report_type === "summary") {
                return <SummaryReport report={parsed} />;
            }
        } catch (_) {
            // not JSON, fall through to normal rendering
        }
    }

    return (
        <>
            <p className="leading-relaxed whitespace-pre-wrap">{answer}</p>

            {table && table.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-white/10 mt-2">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white/5 text-slate-300 uppercase text-xs">
                            <tr>
                                {Object.keys(table[0]).map((key) => (
                                    <th key={key} className="px-4 py-3 border-b border-white/10 whitespace-nowrap">{key}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {table.map((row, i) => (
                                <tr key={i} className="hover:bg-white/5">
                                    {Object.values(row).map((val, j) => (
                                        <td key={j} className="px-4 py-2 whitespace-nowrap">
                                        {typeof val === "object" && val !== null ? (
                                            <div className="space-y-1">
                                            {Object.entries(val).map(([k, v]) => (
                                                <div key={k}>
                                                <span className="text-slate-400">{k}:</span> {v}
                                                </div>
                                            ))}
                                            </div>
                                        ) : (
                                            val ?? '—'
                                        )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {error && (
                <p className="text-red-400 text-xs mt-1">⚠️ Table could not be generated: {error}</p>
            )}
        </>
    );
}

// ── Rich Summary Report Renderer ────────────────────────────────────────────
function SummaryReport({ report }) {
    const {
        title,
        overview,
        date_range,
        key_metrics = [],
        highlights = [],
        sections = [],
        recommendations = [],
    } = report;

    return (
        <div className="w-full text-sm space-y-6">

            {/* Header — title + date as quiet context, not emphasis */}
            <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-medium">
                    Analysis
                    {date_range ? ` · ${date_range}` : ""}
                </p>
                <h2 className="text-[15px] font-semibold text-white leading-snug">{title}</h2>
            </div>

            {/* Overview — the story, big and readable */}
            {overview && (
                <p className="text-slate-200 leading-relaxed text-[14px] border-l-2 border-blue-500/60 pl-3">
                    {overview}
                </p>
            )}

            {/* Highlights — the "wow" moments, visually distinct */}
            {highlights.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">Key Findings</p>
                    {highlights.map((h, i) => (
                        <div key={i} className="flex gap-2.5 items-start">
                            <span className="mt-[3px] shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400/80" />
                            <p className="text-slate-200 leading-snug">{h}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Key Metrics — compact, only the most important 3-5 */}
            {key_metrics.length > 0 && (
                <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium mb-2">The Numbers</p>
                    <div className="grid grid-cols-2 gap-2">
                        {key_metrics.slice(0, 6).map((m, i) => (
                            <div key={i} className={`rounded-xl px-3 py-2.5 border ${
                                i === 0
                                    ? "border-blue-500/30 bg-blue-500/8 col-span-2"
                                    : "border-white/8 bg-white/4"
                            }`}>
                                <p className="text-slate-400 text-xs">{m.label}</p>
                                <p className={`font-bold text-white ${i === 0 ? "text-xl mt-0.5" : "text-base mt-0.5"}`}>
                                    {m.value}
                                </p>
                                {m.plain_note && (
                                    <p className="text-slate-500 text-xs mt-1 leading-snug">{m.plain_note}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sections — only the meaningful breakdowns */}
            {sections.map((section, si) => (
                <div key={si} className="space-y-2">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
                        {section.heading}
                    </p>

                    {/* Plain-English story for this section */}
                    {section.body && (
                        <p className="text-slate-300 leading-relaxed">{section.body}</p>
                    )}

                    {/* Subsections — only winners/losers worth naming */}
                    {section.subsections && section.subsections.length > 0 && (
                        <div className="space-y-1.5 mt-1">
                            {section.subsections.map((sub, ssi) => (
                                <div key={ssi} className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
                                    {/* Name + verdict on same line when short, stacked when long */}
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5">
                                        <span className="text-white font-medium text-xs">{sub.name}</span>
                                        {sub.verdict && (
                                            <span className="text-slate-400 text-xs leading-snug">— {sub.verdict}</span>
                                        )}
                                    </div>
                                    {/* Stats: only 2-3, small and secondary */}
                                    {sub.stats && sub.stats.length > 0 && (
                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                            {sub.stats.slice(0, 3).map((stat, sti) => (
                                                <span key={sti} className="text-xs text-slate-500">
                                                    {stat.label}:{" "}
                                                    <span className="text-slate-300 font-medium">{stat.value}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {/* Recommendations — action-oriented, plain English */}
            {recommendations.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-2">
                    <p className="text-xs text-amber-400/80 uppercase tracking-widest font-medium">What to do next</p>
                    {recommendations.map((rec, i) => (
                        <div key={i} className="flex gap-2.5 items-start">
                            <span className="text-amber-400/60 font-bold text-xs shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-slate-300 leading-snug text-[13px]">{rec}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ChatView;