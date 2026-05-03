
import React, { useState, useEffect, useRef } from 'react';
import { BookProject, AppView, Source, SourceType, WritingStyle, ChapterContent, User } from './types';
import { Dashboard } from './components/Dashboard';
import { ProjectEditor } from './components/ProjectEditor';
import { AuthScreen } from './components/AuthScreen';
import { writeChapter } from './services/gemini';
import { StorageService } from './services/storage';
import { CloudService } from './services/cloud';
import { Sparkles, Key, Loader2 } from 'lucide-react';
import { CostTracker } from './components/CostTracker';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [projects, setProjects] = useState<BookProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<User | undefined>(undefined);
  
  // API Key State
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isKeyChecked, setIsKeyChecked] = useState(false);
  
  // Background Generation State
  const [generatingProjectId, setGeneratingProjectId] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Sync State
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Initial Key Check
  useEffect(() => {
    const checkKey = async () => {
      try {
        if ((window as any).aistudio) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
        } else {
            // If running outside IDX/AI Studio wrapper, assume true or rely on env var
            setHasApiKey(true);
        }
      } catch (e) {
        console.error("Failed to check API key", e);
        setHasApiKey(true);
      } finally {
        setIsKeyChecked(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
      }
      setHasApiKey(true);
    } catch(e: any) {
      console.error(e);
      if (e.message && e.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
    }
  };

  // Initial Load from Storage
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedUser = localStorage.getItem('lore_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);

          const loadedProjects = await StorageService.getAllProjects(parsedUser.username);
          // Initialize last synced state so we don't spam the server on load
          loadedProjects.forEach((p: BookProject) => {
            lastSyncedProjectsRef.current[p.id] = p.lastModified;
          });
          setProjects(loadedProjects);
          
          const lastActiveId = await StorageService.getActiveProjectId(parsedUser.username);
          if (lastActiveId && loadedProjects.find((p: BookProject) => p.id === lastActiveId)) {
            setActiveProjectId(lastActiveId);
            setView(AppView.EDITOR);
            window.history.replaceState({ view: AppView.EDITOR, projectId: lastActiveId }, '');
          } else {
             setView(AppView.DASHBOARD);
          }
        }
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save changes to Local Storage
  useEffect(() => {
    if (!isLoaded || !user) return; 

    const saveData = async () => {
      try {
        await StorageService.saveAllProjects(user.username, projects);
        await StorageService.saveActiveProjectId(user.username, activeProjectId);
      } catch (e: any) {
        if (e.name === 'QuotaExceededError') {
           alert("⚠️ Disk Full! Your device storage is full.");
        } else {
           console.error("Failed to save project", e);
        }
      }
    };

    const timeout = setTimeout(saveData, 500);
    return () => clearTimeout(timeout);
  }, [projects, activeProjectId, isLoaded, user]);

  const lastSyncedProjectsRef = useRef<Record<string, number>>({});

  // Auto-save modified projects to Cloud (Debounced)
  useEffect(() => {
    if (!user || projects.length === 0) return;

    const timeout = setTimeout(async () => {
        for (const project of projects) {
          const lastSynced = lastSyncedProjectsRef.current[project.id] || 0;
          if (project.lastModified > lastSynced) {
            try {
                await CloudService.syncUp(user, project);
                lastSyncedProjectsRef.current[project.id] = project.lastModified;
                console.log(`Cloud auto-save complete for ${project.title}`);
            } catch (e) {
                console.error(`Cloud auto-save failed for ${project.title}`, e);
            }
          }
        }
    }, 5000); 

    return () => clearTimeout(timeout);
  }, [projects, user]);

  // Handle Browser Back Button
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (!user) {
        setView(AppView.AUTH);
        return;
      }
      if (event.state && event.state.view === AppView.EDITOR) {
        setActiveProjectId(event.state.projectId);
        setView(AppView.EDITOR);
      } else {
        setActiveProjectId(null);
        setView(AppView.DASHBOARD);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  // --- Background Generator Logic ---

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        console.warn(`Wake Lock failed: ${err}`);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.error(`Wake Lock release failed: ${err}`);
      }
    }
  };

  const startBookGeneration = async (projectId: string, style: WritingStyle) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.outline) return;
    
    setGeneratingProjectId(projectId);
    await requestWakeLock();

    const currentChapters: ChapterContent[] = project.outline.chapters.map(outlineChap => {
      const existing = project.chapters.find(c => c.chapterNumber === outlineChap.chapterNumber);
      if (existing) {
        return { ...existing, title: outlineChap.title };
      }
      return {
        chapterNumber: outlineChap.chapterNumber,
        title: outlineChap.title,
        content: '',
        isGenerating: true
      };
    });

    handleUpdateProject({ ...project, chapters: currentChapters });

    let hasFatalError = false;

    for (const chapOutline of project.outline.chapters) {
      const chapterToGen = currentChapters.find(c => c.chapterNumber === chapOutline.chapterNumber);
      
      if (chapterToGen && chapterToGen.content && !chapterToGen.isGenerating) {
        continue;
      }
      
      if (hasFatalError) break;

      try {
        const content = await writeChapter(chapOutline, project.outline, project.sources, style);
        
        setProjects(prevProjects => prevProjects.map(p => {
          if (p.id !== projectId) return p;
          
          const updatedChapters = p.chapters.map(c => 
            c.chapterNumber === chapOutline.chapterNumber 
              ? { ...c, content, isGenerating: false }
              : c
          );
          
          return { ...p, chapters: updatedChapters, lastModified: Date.now() };
        }));

        const idx = currentChapters.findIndex(c => c.chapterNumber === chapOutline.chapterNumber);
        if (idx !== -1) {
            currentChapters[idx] = { ...currentChapters[idx], content, isGenerating: false };
        }

      } catch (e: any) {
         console.error(`Error generating chapter ${chapOutline.chapterNumber}`, e);
         const isFatal = e.message?.includes('leaked') || e.message?.includes('PERMISSION_DENIED') || e.status === 403;
         
         if (isFatal) {
             hasFatalError = true;
             alert(`Generation Stopped: ${e.message}`);
         }

         setProjects(prevProjects => prevProjects.map(p => {
            if (p.id !== projectId) return p;
            const updatedChapters = p.chapters.map(c => 
              c.chapterNumber === chapOutline.chapterNumber 
                ? { ...c, isGenerating: false, content: isFatal ? "Stopped due to API error." : "Generation failed. Please retry." }
                : c
            );
            return { ...p, chapters: updatedChapters };
         }));
      }
    }

    setGeneratingProjectId(null);
    await releaseWakeLock();
  };

  // --- End Generator Logic ---

  const handleCreateProject = () => {
    const newProject: BookProject = {
      id: crypto.randomUUID(),
      title: 'Untitled Manuscript',
      lastModified: Date.now(),
      sources: [],
      outline: null,
      chapters: [],
      currentStep: 0,
    };
    
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setView(AppView.EDITOR);
    window.history.pushState({ view: AppView.EDITOR, projectId: newProject.id }, '');
  };

  const handleCreateSequel = (originalProject: BookProject) => {
     const seriesId = originalProject.seriesId || crypto.randomUUID();
     const nextIndex = (originalProject.seriesIndex || 1) + 1;

     if (!originalProject.seriesId) {
        const updatedOriginal = { ...originalProject, seriesId, seriesIndex: 1 };
        handleUpdateProject(updatedOriginal);
        if (user) {
          try {
            CloudService.syncUp(user, updatedOriginal).catch(console.error);
          } catch(e) {}
        }
     }

     const contextContent = `PREVIOUS BOOK CONTEXT:
Title: ${originalProject.title}
Description: ${originalProject.outline?.description || 'No description available.'}

CHAPTER SUMMARIES:
${originalProject.outline?.chapters.map(c => `Chapter ${c.chapterNumber}: ${c.title}\n${c.summary}`).join('\n\n') || 'No chapters available.'}
`;

    const contextSource: Source = {
      id: crypto.randomUUID(),
      type: SourceType.TEXT,
      name: `Context: ${originalProject.title}`,
      content: contextContent,
      isProcessing: false
    };

    const newProject: BookProject = {
      id: crypto.randomUUID(),
      title: `Sequel to ${originalProject.title}`,
      lastModified: Date.now(),
      sources: [contextSource],
      outline: null,
      chapters: [],
      currentStep: 0,
      seriesId: seriesId,
      seriesIndex: nextIndex
    };

    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setView(AppView.EDITOR);
    window.history.pushState({ view: AppView.EDITOR, projectId: newProject.id }, '');
  };

  const handleUpdateProject = (updatedProject: BookProject) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setView(AppView.DASHBOARD);
        window.history.replaceState({ view: AppView.DASHBOARD }, '');
      }
      if (user) {
        try {
          await CloudService.deleteProject(user, id);
        } catch (error) {
          console.error("Failed to delete project from cloud", error);
        }
      }
    }
  };

  const handleSelectProject = (project: BookProject) => {
    setActiveProjectId(project.id);
    setView(AppView.EDITOR);
    window.history.pushState({ view: AppView.EDITOR, projectId: project.id }, '');
  };

  const handleBackToDashboard = () => {
    setActiveProjectId(null);
    setView(AppView.DASHBOARD);
    window.history.pushState({ view: AppView.DASHBOARD }, '');
  };

  const handleLogin = async (user: User) => {
    setIsLoggingIn(true);
    setUser(user);
    localStorage.setItem('lore_user', JSON.stringify(user));

    try {
        // First load any local projects for this specific user
        const localProjects = await StorageService.getAllProjects(user.username);
        
        // Automatically sync down from cloud to get previous books
        const cloudProjects = await CloudService.syncDown(user);
        
        // Merge Strategy: Combine cloud and local for this user
        const merged = [...localProjects];
        cloudProjects.forEach(cp => {
            const existingIdx = merged.findIndex(p => p.id === cp.id);
            if (existingIdx !== -1) {
                // Update if cloud version is newer
                if (cp.lastModified > merged[existingIdx].lastModified) {
                    merged[existingIdx] = cp;
                }
            } else {
                // Add new from cloud
                merged.push(cp);
            }
        });
        
        merged.forEach((p: BookProject) => {
          lastSyncedProjectsRef.current[p.id] = p.lastModified;
        });

        setProjects(merged);
        // Persist merged state to local storage immediately
        StorageService.saveAllProjects(user.username, merged);

    } catch(e) {
        console.error("Auto-sync on login failed", e);
        // Just load local if sync fails
        try {
          const localProjects = await StorageService.getAllProjects(user.username);
          setProjects(localProjects);
        } catch(e2) {}
    } finally {
        setIsLoggingIn(false);
        setView(AppView.DASHBOARD);
    }
  };

  const handleLogout = () => {
    setUser(undefined);
    setProjects([]);
    setActiveProjectId(null);
    localStorage.removeItem('lore_user');
    setView(AppView.AUTH);
  };

  const handleSyncProjects = (cloudProjects: BookProject[]) => {
      const merged = [...projects];
      cloudProjects.forEach(cp => {
          const idx = merged.findIndex(p => p.id === cp.id);
          if (idx !== -1) {
              if (cp.lastModified > merged[idx].lastModified) {
                  merged[idx] = cp;
              }
          } else {
              merged.push(cp);
          }
      });
      merged.forEach(p => {
        lastSyncedProjectsRef.current[p.id] = p.lastModified;
      });
      setProjects(merged);
  };

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Loading State for API Key and Data
  if (!isKeyChecked || !isLoaded) {
     return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
           <div className="animate-pulse flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-200 rounded-full mb-4"></div>
              <div className="text-slate-400 font-medium">Initializing Lore...</div>
           </div>
        </div>
     );
  }
  
  // Login loading state
  if (isLoggingIn) {
     return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
           <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <div className="text-slate-800 font-bold text-lg">Syncing Library...</div>
              <p className="text-slate-500 text-sm mt-1">Retrieving your books from the cloud.</p>
           </div>
        </div>
     );
  }

  // API Key Selection Screen (Priority 1)
  if (!hasApiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full">
           <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles size={32} />
           </div>
           <h1 className="text-3xl font-serif font-bold text-slate-900 mb-3">Welcome to Lore</h1>
           <p className="text-slate-600 mb-8 leading-relaxed">
             To generate full-length manuscripts and professional book covers, Lore requires access to Google's advanced AI models.
           </p>
           
           <button 
             onClick={handleSelectKey}
             className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 hover:scale-[1.02] flex items-center justify-center gap-2"
           >
             <Key size={20} />
             Connect Google API Key
           </button>

           <div className="mt-6 text-xs text-slate-400">
             <p className="mb-2">This app uses <span className="font-semibold text-slate-500">Gemini 3 Pro</span> and <span className="font-semibold text-slate-500">Imagen 3</span>.</p>
             <p>
               Please ensure you select a paid project. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-blue-600">View Billing Documentation</a>.
             </p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CostTracker />
      {/* Auth Screen (Priority 2) */}
      {(!user || view === AppView.AUTH) ? (
        <AuthScreen onLogin={handleLogin} />
      ) : (
        /* Main App */
        (view === AppView.EDITOR && activeProject) ? (
          <ProjectEditor 
            project={activeProject} 
            onUpdateProject={handleUpdateProject}
            onBack={handleBackToDashboard}
            onStartGeneration={(style) => startBookGeneration(activeProject.id, style)}
            isGeneratingGlobal={generatingProjectId === activeProject.id}
            user={user}
          />
        ) : (
          <Dashboard 
            projects={projects} 
            user={user}
            onCreateProject={handleCreateProject}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteProject}
            onCreateSequel={handleCreateSequel}
            onSyncProjects={handleSyncProjects}
            onLogout={handleLogout}
            generatingProjectId={generatingProjectId}
          />
        )
      )}
    </>
  );
};

export default App;
