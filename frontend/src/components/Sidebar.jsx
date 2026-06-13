import React from 'react';
import {
    LayoutDashboard,
    Upload,
    BarChart3,
    History,
    Settings,
    Database,
    ChevronRight
} from 'lucide-react';

const SidebarItem = ({ icon: Icon, label, active = false, onClick }) => (
    <div 
    onClick={onClick}
    className={`
    flex items-center group gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300
    ${active
            ? 'sidebar-item-active'
            : 'text-slate-500 hover:text-white hover:bg-white/5'}
  `}>
        <Icon size={20} className={`${active ? 'text-blue-500' : 'group-hover:text-blue-400'} transition-colors`} />
        <span className="font-medium flex-1">{label}</span>
        {active && <ChevronRight size={14} className="text-blue-500" />}
    </div>
);

const Sidebar = ({ activeView, setActiveView }) => {
    return (
        <div className="w-[220px] h-screen bg-[#080b12] border-r border-white/5 flex flex-col p-6 fixed left-0 top-0 z-20">
            <div className="flex items-center gap-3 mb-12">
                <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 shadow-glow">
                    <Database size={24} className="text-blue-500" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight">AI Analyzer</h1>
                    <p className="text-[10px] text-blue-500/60 font-black uppercase tracking-widest">Premium</p>
                </div>
            </div>

            <nav className="flex-1 space-y-2">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-4 mb-4">Core Actions</p>

                <SidebarItem 
                    icon={LayoutDashboard} 
                    label="Dashboard"
                    active={activeView === "dashboard"}
                    onClick={() => setActiveView("dashboard")}
                />

                <SidebarItem 
                    icon={Upload} 
                    label="Upload Data" 
                    active={activeView === "upload"}
                    onClick={() => setActiveView("upload")}
                />

                <SidebarItem 
                    icon={BarChart3} 
                    label="Chat Analysis"
                    active={activeView === "chat"}
                    onClick={() => setActiveView("chat")}
                />
            </nav>

            <div className="pt-6 border-t border-white/5">
                <SidebarItem icon={Settings} label="Settings" />
            </div>
        </div>
    );
};

export default Sidebar;