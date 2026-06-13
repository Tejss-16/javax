import React from 'react';
import { Search, Bell, Settings, User } from 'lucide-react';

const Header = () => {
    return (
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0b0f19]/80 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search datasets, reports..."
                        className="w-full bg-[#131926] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all relative">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#0b0f19]"></span>
                </button>
                <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                    <Settings size={20} />
                </button>
                <div className="h-8 w-[1px] bg-white/5 mx-2"></div>
                <div className="flex items-center gap-3 pl-2 cursor-pointer hover:opacity-80 transition-opacity">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold">User Profile</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Pro Account</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 p-[1px]">
                        <div className="w-full h-full rounded-[11px] bg-[#131926] flex items-center justify-center">
                            <User size={20} className="text-white" />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
