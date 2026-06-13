// src/App.jsx  (FIXED)
//
// CHANGE: dashboard now accumulates query results instead of replacing them.
//   - analysisData  (single object) → queryHistory (array of {query, data})
//   - Each new query APPENDS a new entry; previous results stay visible.
//   - A "Clear All" button lets users wipe the history when needed.

import React, { useState, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import FileInput from './components/FileInput';
import PromptInput from './components/PromptInput';
import AnalysisOutput from './components/AnalysisOutput';
import { AlertCircle } from 'lucide-react';
import ChatView from './components/ChatView';
import { API_URL } from "./config";

const POLL_INTERVAL_MS = 2000;

function App() {
    const [file, setFile] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeView, setActiveView] = useState("upload");
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState(null);

    // CHANGE: array of { query: string, data: object } instead of a single analysisData
    const [queryHistory, setQueryHistory] = useState([]);

    const [datasetId, setDatasetId] = useState(null);

    const taskIdRef = useRef(null);
    const pollingRef = useRef(false);

    const stopPolling = () => { pollingRef.current = false; };

    const resetState = () => {
        setLoading(false);
        setIsCancelling(false);
        taskIdRef.current = null;
        pollingRef.current = false;
    };

    const handleUpload = async (selectedFile) => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append("file", selectedFile);

        const res = await fetch(`${API_URL}/upload`, {
            method: "POST",
            body: formData
        });
        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();
        console.log("DATASET ID:", data.dataset_id);
        setDatasetId(data.dataset_id);

        // Clear history when a new dataset is uploaded
        setQueryHistory([]);
    };

    const handleAnalyze = useCallback(async () => {
        if (!datasetId) {
            alert("Upload a dataset first");
            return;
        }
        if (!prompt) {
            alert("Enter a prompt");
            return;
        }

        // Cancel any in-flight task
        if (taskIdRef.current) {
            await fetch(`${API_URL}/cancel/${taskIdRef.current}`, { method: 'POST' }).catch(() => {});
        }

        stopPolling();
        setIsCancelling(false);
        setError(null);

        // Snapshot the query string so we can label the result block
        const currentQuery = prompt;

        const formData = new FormData();
        formData.append('dataset_id', datasetId);
        formData.append('query', currentQuery);

        try {
            const startRes = await fetch(`${API_URL}/start-analysis`, {
                method: 'POST',
                body: formData,
            });

            if (!startRes.ok) throw new Error(await startRes.text());

            const { task_id } = await startRes.json();

            setLoading(true);
            taskIdRef.current = task_id;
            pollingRef.current = true;

            let attempts = 0;
            const MAX_ATTEMPTS = 100;

            while (pollingRef.current && attempts < MAX_ATTEMPTS) {
                attempts++;
                await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

                const statusRes = await fetch(`${API_URL}/status/${task_id}`);
                if (!statusRes.ok) throw new Error("Status API failed");

                const result = await statusRes.json();

                if (["completed", "cancelled", "error"].includes(result.status)) {
                    stopPolling();

                    if (result.status === "completed") {
                        // CHANGE: append new result; do NOT clear previous ones
                        setQueryHistory(prev => [
                            ...prev,
                            { query: currentQuery, data: result.data }
                        ]);
                    }

                    if (result.status === "error") throw new Error(result.error);
                    break;
                }
            }

        } catch (err) {
            if (pollingRef.current) setError(err.message);
        } finally {
            resetState();
        }
    }, [datasetId, prompt]);

    const handleCancel = useCallback(() => {
        const taskId = taskIdRef.current;
        if (!taskId) return;
        setIsCancelling(true);
        stopPolling();
        fetch(`${API_URL}/cancel/${taskId}`, { method: 'POST' }).catch(() => {});
    }, []);

    // CHANGE: clear all accumulated results
    const handleClearHistory = () => setQueryHistory([]);

    return (
        <div className="flex min-h-screen bg-[#0b0f19] text-white">
            <Sidebar activeView={activeView} setActiveView={setActiveView} />

            <div className="flex-1 ml-[220px] flex flex-col min-h-screen">
                <Header />

                <main className="p-6 flex-1 flex flex-col">
                    <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">

                        {/* UPLOAD VIEW */}
                        {activeView === "upload" && (
                            <div className="flex flex-col justify-center items-center h-full gap-4">
                                <FileInput
                                    file={file}
                                    setFile={setFile}
                                    onUpload={handleUpload}
                                />
                                {datasetId && (
                                    <p className="text-green-400">
                                        Dataset uploaded successfully
                                    </p>
                                )}
                            </div>
                        )}

                        {/* DASHBOARD VIEW */}
                        {activeView === "dashboard" && (
                            <>
                                <div className="grid grid-cols-1 gap-8 mb-10">
                                    <PromptInput prompt={prompt} setPrompt={setPrompt} />
                                </div>

                                <div className="flex justify-center mb-12 gap-4">
                                    {/* Execute */}
                                    <button
                                        onClick={handleAnalyze}
                                        className="btn-gradient px-12 py-5"
                                        disabled={!datasetId || loading}
                                    >
                                        {loading ? "Running..." : "Execute Analysis"}
                                    </button>

                                    {/* Stop */}
                                    {loading && (
                                        <button
                                            onClick={handleCancel}
                                            className="bg-red-600 px-8 py-5 rounded-xl hover:bg-red-500 transition"
                                        >
                                            Stop
                                        </button>
                                    )}

                                    {/* CHANGE: clear history button */}
                                    {queryHistory.length > 0 && !loading && (
                                        <button
                                            onClick={handleClearHistory}
                                            className="bg-white/5 border border-white/10 px-8 py-5 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>

                                {/* Error display */}
                                {error && (
                                    <div className="flex items-center gap-2 text-red-400 mb-4 p-3 bg-red-950/20 rounded-xl border border-red-500/20">
                                        <AlertCircle size={16} />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}

                                {/* CHANGE: pass queryHistory + loading instead of single analysisData */}
                                <AnalysisOutput
                                    queryHistory={queryHistory}
                                    loading={loading}
                                    currentQuery={prompt}
                                />
                            </>
                        )}

                        {/* CHAT VIEW */}
                        {activeView === "chat" && (
                            <ChatView datasetId={datasetId} />
                        )}

                    </div>
                </main>
            </div>
        </div>
    );
}

export default App;