import React from 'react';
import { Sparkles } from 'lucide-react';

const PromptInput = ({ prompt, setPrompt }) => {
    return (
        <div className="glass-card hover:border-purple-500/20 p-8 flex flex-col gap-4 min-h-[220px]">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles size={16} className="text-purple-400" />
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                    Enter Analysis Prompt
                </label>
            </div>

            <div className="flex-1 relative">
                <textarea
                    className="w-full h-full p-4 bg-white/5 border border-white/5 rounded-2xl outline-none resize-none text-white placeholder:text-slate-600 text-base focus:border-blue-500/30 transition-all shadow-inner"
                    placeholder="e.g., 'Create a sales trend graph' or 'Show top 5 products'..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                ></textarea>
            </div>

            <p className="text-[11px] text-slate-500 italic px-2">
                Describe what insights or visualizations you want from the dataset.
            </p>
        </div>
    );
};

export default PromptInput;
