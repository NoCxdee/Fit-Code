/* ================================================================
   Fit — App Shell
   Main application layout with all panels and state persistence.
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { TitleBar } from './components/layout/TitleBar';
import { MainContent } from './components/layout/MainContent';
import { FileDrawer } from './components/layout/FileDrawer';
import { SettingsModal } from './components/layout/SettingsModal';
import { AboutModal } from './components/layout/AboutModal';
import { UpdateModal } from './components/layout/UpdateModal';
import { WelcomeScreen } from './components/layout/WelcomeScreen';
import { Loader } from './components/layout/Loader';
import { DictationPopup } from './components/layout/DictationPopup';
import { useAppState, useAppDispatch } from './stores/appStore';
import { loadState, saveState, gitStatus, checkUpdate, writeFile, checkDirectoryExists, resolveWorkspacePath } from './utils/ipc';
import { open } from '@tauri-apps/plugin-dialog';
import { generateId } from './utils/generateId';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { UnsavedChangesDialog } from './components/layout/UnsavedChangesDialog';
import { unsavedContents } from './components/editor/CodeEditor';

export function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const initialized = useRef(false);
  const lastStateRef = useRef(state);
  const [showLoader, setShowLoader] = useState(true);
  const [unsavedDialogAction, setUnsavedDialogAction] = useState<'close' | 'reload' | null>(null);
  const bypassCloseRef = useRef(false);
  const appWindow = getCurrentWindow();

  const [missingWorkspace, setMissingWorkspace] = useState<any>(null);

  useEffect(() => {
    const activeWorkspaceId = state.activeWorkspaceId;
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) {
      setMissingWorkspace(null);
      return;
    }

    let isSubscribed = true;
    const wsId = activeWorkspace.id;
    const wsPath = activeWorkspace.path;

    async function checkWorkspace() {
      const exists = await checkDirectoryExists(wsPath);
      if (!isSubscribed) return;

      if (!exists) {
        // Try to auto-resolve first
        try {
          const resolved = await resolveWorkspacePath(wsPath);
          if (!isSubscribed) return;
          if (resolved) {
            const [newPath, newName] = resolved;
            if (newPath !== wsPath) {
              dispatch({
                type: 'RESOLVE_WORKSPACE_PATH',
                payload: { id: wsId, path: newPath, name: newName }
              });
              return;
            }
          }
        } catch (err) {
          console.error('Failed to resolve workspace path:', err);
        }

        // If we couldn't resolve it, show the missing workspace dialog
        setMissingWorkspace(activeWorkspace);
      } else {
        setMissingWorkspace(null);
      }
    }

    checkWorkspace();

    return () => {
      isSubscribed = false;
    };
  }, [state.activeWorkspaceId, state.workspaces, dispatch]);

  const handleRemoveMissingWorkspace = () => {
    if (missingWorkspace) {
      dispatch({ type: 'REMOVE_WORKSPACE', payload: missingWorkspace.id });
      setMissingWorkspace(null);
    }
  };

  const handleLocateMissingWorkspace = async () => {
    if (!missingWorkspace) return;
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Locate Workspace Folder',
      });
      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\/]/).pop() || 'Workspace';
        dispatch({
          type: 'RESOLVE_WORKSPACE_PATH',
          payload: { id: missingWorkspace.id, path: selected, name }
        });
        setMissingWorkspace(null);
      }
    } catch (error) {
      console.error('Failed to open workspace directory:', error);
    }
  };

  const handleCancelMissingWorkspace = () => {
    if (!missingWorkspace) return;
    const nextWorkspace = state.workspaces.find(w => w.id !== missingWorkspace.id);
    if (nextWorkspace) {
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', payload: nextWorkspace.id });
    } else {
      dispatch({ type: 'REMOVE_WORKSPACE', payload: missingWorkspace.id });
    }
    setMissingWorkspace(null);
  };
  const [isLeftSidebarRevealed, setIsLeftSidebarRevealed] = useState(false);
  const leftSidebarTimeoutRef = useRef<any>(null);
  const [isRightSidebarRevealed, setIsRightSidebarRevealed] = useState(false);
  const rightSidebarTimeoutRef = useRef<any>(null);

  const handleLeftSidebarMouseEnter = () => {
    if (leftSidebarTimeoutRef.current) {
      clearTimeout(leftSidebarTimeoutRef.current);
      leftSidebarTimeoutRef.current = null;
    }
    setIsLeftSidebarRevealed(true);
  };

  const handleLeftSidebarMouseLeave = () => {
    if (leftSidebarTimeoutRef.current) {
      clearTimeout(leftSidebarTimeoutRef.current);
    }
    leftSidebarTimeoutRef.current = setTimeout(() => {
      setIsLeftSidebarRevealed(false);
      leftSidebarTimeoutRef.current = null;
    }, 150);
  };

  const handleRightSidebarMouseEnter = () => {
    if (rightSidebarTimeoutRef.current) {
      clearTimeout(rightSidebarTimeoutRef.current);
      rightSidebarTimeoutRef.current = null;
    }
    setIsRightSidebarRevealed(true);
  };

  const handleRightSidebarMouseLeave = () => {
    if (rightSidebarTimeoutRef.current) {
      clearTimeout(rightSidebarTimeoutRef.current);
    }
    rightSidebarTimeoutRef.current = setTimeout(() => {
      setIsRightSidebarRevealed(false);
      rightSidebarTimeoutRef.current = null;
    }, 150);
  };

  useEffect(() => {
    if (!state.autoHideSidebar) {
      if (leftSidebarTimeoutRef.current) {
        clearTimeout(leftSidebarTimeoutRef.current);
        leftSidebarTimeoutRef.current = null;
      }
      setIsLeftSidebarRevealed(false);
      if (rightSidebarTimeoutRef.current) {
        clearTimeout(rightSidebarTimeoutRef.current);
        rightSidebarTimeoutRef.current = null;
      }
      setIsRightSidebarRevealed(false);
    }
  }, [state.autoHideSidebar]);
  const { 
    settingsOpen
  } = state;


  const handleLoaderFinished = () => {
    setShowLoader(false);
  };

  // Load state on mount and check updates
  useEffect(() => {
    async function init() {
      try {
        const savedState = await loadState();
        if (savedState && savedState.workspaces) {
          dispatch({ type: 'LOAD_STATE', payload: savedState });
        }
      } catch (err) {
        console.error('Failed to load state:', err);
      } finally {
        initialized.current = true;
        
        // Check for updates on startup if enabled
        try {
          const stored = localStorage.getItem('fit_check_on_startup');
          const checkEnabled = stored !== null ? stored === 'true' : true;
          if (checkEnabled) {
            const result = await checkUpdate();
            if (result && result.available) {
              dispatch({
                type: 'SET_PENDING_UPDATE',
                payload: { version: result.version, body: result.body }
              });
            }
          }
        } catch (updateErr) {
          console.error('Startup update check failed:', updateErr);
        }
      }
    }
    init();
  }, [dispatch]);

  // Save state on change (immediate for critical changes, debounced for panel resizes)
  // gitStatus is excluded from saves — it's transient and reset on load
  useEffect(() => {
    if (!initialized.current) {
      lastStateRef.current = state;
      return;
    }

    const prevState = lastStateRef.current;
    lastStateRef.current = state;

    // Skip save entirely if ONLY gitStatus changed
    if (prevState.gitStatus !== state.gitStatus) {
      // Check if anything else changed too
      const otherChanged =
        prevState.workspaces !== state.workspaces ||
        prevState.activeWorkspaceId !== state.activeWorkspaceId ||
        prevState.sessions !== state.sessions ||
        prevState.activeSessionId !== state.activeSessionId ||
        prevState.openTabs !== state.openTabs ||
        prevState.activeTabId !== state.activeTabId ||
        prevState.fileDrawerOpen !== state.fileDrawerOpen ||
        prevState.panelSizes !== state.panelSizes ||
        prevState.drawerTab !== state.drawerTab ||
        prevState.useWebGl !== state.useWebGl ||
        prevState.autoSave !== state.autoSave ||
        prevState.autoHideSidebar !== state.autoHideSidebar ||
        prevState.linkOpeningMode !== state.linkOpeningMode;
      if (!otherChanged) return; // gitStatus only — skip save
    }

    // Exclude transient state from persistence
    const { gitStatus: _gs, settingsOpen: _so, aboutOpen: _ao, pendingUpdate: _pu, inspectorMode: _im, capturedElement: _ce, ...stateToSave } = state;

    // Check if anything other than panelSizes changed
    const isCriticalChange =
      prevState.workspaces !== state.workspaces ||
      prevState.activeWorkspaceId !== state.activeWorkspaceId ||
      prevState.sessions !== state.sessions ||
      prevState.activeSessionId !== state.activeSessionId ||
      prevState.openTabs !== state.openTabs ||
      prevState.activeTabId !== state.activeTabId ||
      prevState.fileDrawerOpen !== state.fileDrawerOpen ||
      prevState.autoSave !== state.autoSave ||
      prevState.autoHideSidebar !== state.autoHideSidebar ||
      prevState.linkOpeningMode !== state.linkOpeningMode;

    console.log('[FIT DEBUG] State change detected:', {
      prevAutoHide: prevState.autoHideSidebar,
      currentAutoHide: state.autoHideSidebar,
      isCriticalChange
    });

    if (isCriticalChange) {
      console.log('[FIT DEBUG] Saving state immediately...', stateToSave);
      saveState(stateToSave as any)
        .then(() => console.log('[FIT DEBUG] State saved successfully immediately!'))
        .catch(err => console.error('Failed to save state immediately:', err));
      return;
    }

    // Debounce saving only for non-critical changes (e.g. panel resizes)
    const timeoutId = setTimeout(() => {
      console.log('[FIT DEBUG] Saving state debounced...', stateToSave);
      saveState(stateToSave as any)
        .then(() => console.log('[FIT DEBUG] State saved successfully debounced!'))
        .catch(err => console.error('Failed to save state:', err));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state]);

  useEffect(() => {
    if (state.activeWorkspaceId) {
      const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
      if (activeWorkspace) {
        try {
          const recentsRaw = localStorage.getItem('fit_recent_projects');
          const recents = recentsRaw ? JSON.parse(recentsRaw) : [];
          const existingIndex = recents.findIndex((p: any) => p.id === activeWorkspace.id || p.path === activeWorkspace.path);
          
          const newProject = {
            id: activeWorkspace.id,
            name: activeWorkspace.name,
            path: activeWorkspace.path,
            color: activeWorkspace.color,
            icon: activeWorkspace.icon,
            lastOpened: Date.now(),
          };

          if (existingIndex > -1) {
            recents[existingIndex] = newProject;
          } else {
            recents.push(newProject);
          }

          // Sort by lastOpened desc
          recents.sort((a: any, b: any) => b.lastOpened - a.lastOpened);
          
          // Keep max 10 recent projects
          const trimmed = recents.slice(0, 10);
          localStorage.setItem('fit_recent_projects', JSON.stringify(trimmed));
        } catch (e) {
          console.error('Failed to save recent projects:', e);
        }
      }
    }
  }, [state.activeWorkspaceId, state.workspaces]);

  // Poll Git status for the active workspace globally
  // Adaptive polling: 5s when git/diff panel visible, 15s otherwise
  useEffect(() => {
    const activeWorkspaceId = state.activeWorkspaceId;
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) {
      dispatch({ type: 'SET_GIT_STATUS', payload: null });
      return;
    }

    let isMounted = true;
    let isPolling = false; // In-flight guard

    async function queryStatus() {
      if (isPolling) return; // Skip if previous call is still in-flight
      isPolling = true;
      try {
        const res = await gitStatus(activeWorkspace!.path);
        if (isMounted) {
          dispatch({ type: 'SET_GIT_STATUS', payload: res });
        }
      } catch (err) {
        console.error('Failed to query git status globally:', err);
      } finally {
        isPolling = false;
      }
    }

    // Query status immediately
    queryStatus();

    // Adaptive interval: faster when git UI is visible
    const isGitVisible = state.fileDrawerOpen && state.drawerTab === 'git';
    const pollInterval = isGitVisible ? 5000 : 15000;
    const interval = setInterval(queryStatus, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [state.activeWorkspaceId, state.workspaces, state.fileDrawerOpen, state.drawerTab, dispatch]);

  // Global Keyboard Shortcuts (Ctrl+T for terminal, Ctrl+P for preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl || e.shiftKey || e.altKey) return;

      const activeWorkspaceId = state.activeWorkspaceId;
      if (!activeWorkspaceId) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
        const activeWorkspaceSessions = state.sessions.filter(s => s.workspaceId === activeWorkspaceId);
        const num = activeWorkspaceSessions.length + 1;
        const name = `session ${num}`;

        const session = {
          id: generateId('session'),
          workspaceId: activeWorkspaceId,
          name,
          rootPanel: {
            id: generateId('split'),
            type: 'split' as const,
            direction: 'horizontal' as const,
            children: [{
              id: generateId('term'),
              type: 'terminal' as const,
              shell: 'powershell-core',
              cwd: activeWorkspace ? activeWorkspace.path : '',
            }],
          },
        };

        dispatch({ type: 'ADD_SESSION', payload: session });
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        dispatch({
          type: 'OPEN_TAB',
          payload: {
            id: `tab-preview-${Date.now()}`,
            type: 'preview',
            title: 'Preview',
            previewUrl: '',
            workspaceId: activeWorkspaceId,
          },
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activeWorkspaceId, state.workspaces, state.sessions, dispatch]);

  // Prevent default drag/drop behaviors globally
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => e.preventDefault();
    
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  // Handle close requested
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    appWindow.onCloseRequested(async (event) => {
      if (bypassCloseRef.current) return;
      const hasUnsaved = state.openTabs.some(t => t.isModified);
      if (hasUnsaved) {
        event.preventDefault();
        setUnsavedDialogAction('close');
      }
    }).then(unlistenFn => {
      unlisten = unlistenFn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [state.openTabs, appWindow]);

  // Intercept reload keyboard events (Ctrl+R, F5)
  useEffect(() => {
    const handleReloadKey = (e: KeyboardEvent) => {
      const isReload = 
        ((e.key === 'r' || e.key === 'R') && (e.ctrlKey || e.metaKey)) || 
        e.key === 'F5';
      if (isReload) {
        const hasUnsaved = state.openTabs.some(t => t.isModified);
        if (hasUnsaved) {
          e.preventDefault();
          setUnsavedDialogAction('reload');
        }
      }
    };
    window.addEventListener('keydown', handleReloadKey, true);
    return () => window.removeEventListener('keydown', handleReloadKey, true);
  }, [state.openTabs]);

  const handleDialogSave = async () => {
    const action = unsavedDialogAction;
    setUnsavedDialogAction(null);
    
    // Save all modified files
    const modifiedTabs = state.openTabs.filter(t => t.isModified && t.filePath);
    await Promise.all(modifiedTabs.map(async (tab) => {
      const content = unsavedContents.get(tab.filePath!);
      if (content !== undefined) {
        try {
          await writeFile(tab.filePath!, content);
          unsavedContents.delete(tab.filePath!);
          dispatch({
            type: 'SET_TAB_MODIFIED',
            payload: { tabId: tab.id, isModified: false }
          });
        } catch (err) {
          console.error(`Failed to save ${tab.filePath}:`, err);
        }
      }
    }));

    // Perform action
    if (action === 'close') {
      bypassCloseRef.current = true;
      appWindow.close().catch(console.error);
    } else if (action === 'reload') {
      window.location.reload();
    }
  };

  const handleDialogDiscard = () => {
    const action = unsavedDialogAction;
    setUnsavedDialogAction(null);
    
    // Discard all changes
    const modifiedTabs = state.openTabs.filter(t => t.isModified && t.filePath);
    modifiedTabs.forEach(tab => {
      unsavedContents.delete(tab.filePath!);
      dispatch({
        type: 'SET_TAB_MODIFIED',
        payload: { tabId: tab.id, isModified: false }
      });
    });

    // Perform action
    if (action === 'close') {
      bypassCloseRef.current = true;
      appWindow.close().catch(console.error);
    } else if (action === 'reload') {
      window.location.reload();
    }
  };

  const handleDialogCancel = () => {
    setUnsavedDialogAction(null);
  };

  if (showLoader) {
    return <Loader onFinished={handleLoaderFinished} />;
  }

  return (
    <div className="app-shell">
      {/* Unified Integrated Title & Tab Bar */}
      <TitleBar />

      {/* Main Body */}
      <div className="app-body">
        {/* Left Sidebar Container */}
        {state.workspaces.length > 0 && (
          <div
            className={[
              "left-sidebar-container",
              state.autoHideSidebar ? "left-sidebar-container--auto-hide" : "",
              (state.autoHideSidebar && isLeftSidebarRevealed) ? "left-sidebar-container--revealed" : ""
            ].filter(Boolean).join(" ")}
            onMouseEnter={state.autoHideSidebar ? handleLeftSidebarMouseEnter : undefined}
            onMouseLeave={state.autoHideSidebar ? handleLeftSidebarMouseLeave : undefined}
          >
            {state.autoHideSidebar && <div className="left-sidebar-handle">
              <div className="left-sidebar-handle-indicator" />
            </div>}
            <LeftSidebar />
          </div>
        )}

        {/* Column 3: Main Area */}
        {state.activeWorkspaceId ? (
          <div className="main-area">
            <div className="main-content">
              <MainContent />
            </div>
          </div>
        ) : (
          <WelcomeScreen />
        )}

        {/* Column 5: File Drawer (Right Sidebar) */}
        {state.activeWorkspaceId && (
          <div 
            className={[
              "right-sidebar-container",
              state.autoHideSidebar ? "right-sidebar-container--auto-hide" : "",
              (state.autoHideSidebar && isRightSidebarRevealed) ? "right-sidebar-container--revealed" : ""
            ].filter(Boolean).join(" ")}
            onMouseEnter={state.autoHideSidebar ? handleRightSidebarMouseEnter : undefined}
            onMouseLeave={state.autoHideSidebar ? handleRightSidebarMouseLeave : undefined}
          >
            {state.autoHideSidebar && <div className="right-sidebar-handle">
              <div className="right-sidebar-handle-indicator" />
            </div>}
            <FileDrawer />
          </div>
        )}
      </div>

      {/* Global Settings Modal overlay */}
      <SettingsModal />
      <AboutModal />
      <UpdateModal />
      <DictationPopup />
      <UnsavedChangesDialog
        isOpen={unsavedDialogAction !== null}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />

      {missingWorkspace && (
        <div className="modal-backdrop" style={{ zIndex: 99999 }}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%' }}>
            <div className="edit-modal__header">
              <span className="edit-modal__title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent-amber)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Workspace Folder Missing
              </span>
            </div>

            <div className="edit-modal__body" style={{ color: 'var(--color-body)', fontSize: 'var(--text-body-sm)', lineHeight: '1.6', paddingBottom: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>
                The folder for the workspace <span style={{ fontWeight: 'bold', color: '#ffffff' }}>"{missingWorkspace.name}"</span> is no longer present on disk or has been deleted:
              </p>
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                wordBreak: 'break-all',
                color: 'var(--color-mute)'
              }}>
                {missingWorkspace.path}
              </div>
              <p>
                Would you like to remove this workspace from the list or locate the folder's new path?
              </p>
            </div>

            <div className="edit-modal__footer" style={{ gap: 'var(--space-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button className="edit-modal__btn edit-modal__btn--discard" onClick={handleRemoveMissingWorkspace} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', whiteSpace: 'nowrap' }}>
                Remove Workspace
              </button>
              <button className="edit-modal__btn edit-modal__btn--save" onClick={handleLocateMissingWorkspace} style={{ whiteSpace: 'nowrap' }}>
                Locate Folder
              </button>
            </div>
          </div>
        </div>
      )}

      <GlobalTooltip />
    </div>
  );
}

function GlobalTooltip() {
  const [state, setState] = useState<{ text: string; rect: DOMRect; target: HTMLElement } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const showTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      while (target && target !== document.body && target !== document.documentElement) {
        if (target.hasAttribute('title') || target.hasAttribute('data-tooltip')) {
          break;
        }
        target = target.parentElement;
      }

      if (target) {
        let text = target.getAttribute('data-tooltip') || '';
        if (target.hasAttribute('title')) {
          const titleText = target.getAttribute('title') || '';
          if (titleText) {
            text = titleText;
            target.setAttribute('data-tooltip', titleText);
            target.removeAttribute('title');
          }
        }

        if (text.trim()) {
          if (showTimeoutRef.current) {
            clearTimeout(showTimeoutRef.current);
          }
          activeTargetRef.current = target;
          
          // Use 'isVisible' state from ref/closure to check if we can update instantly
          // Note: Since activeTargetRef is set, we check if another tooltip is already active
          const isCurrentlyVisible = document.querySelector('.custom-tooltip--visible') !== null;

          if (isCurrentlyVisible) {
            setState({
              text,
              rect: target.getBoundingClientRect(),
              target,
            });
            setIsVisible(true);
          } else {
            showTimeoutRef.current = setTimeout(() => {
              setState({
                text,
                rect: target.getBoundingClientRect(),
                target,
              });
              setIsVisible(true);
            }, 400); // 400ms delay
          }
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }

      let target = e.target as HTMLElement | null;
      while (target && target !== document.body && target !== document.documentElement) {
        if (target.hasAttribute('data-tooltip')) {
          break;
        }
        target = target.parentElement;
      }

      if (target && activeTargetRef.current === target) {
        const text = target.getAttribute('data-tooltip');
        if (text) {
          target.setAttribute('title', text);
        }
        activeTargetRef.current = null;
        setIsVisible(false);
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      const timer = setTimeout(() => {
        setState(null);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  useEffect(() => {
    if (state?.target) {
      const checkMounted = setInterval(() => {
        if (!state.target.isConnected) {
          setIsVisible(false);
        }
      }, 100);
      return () => clearInterval(checkMounted);
    }
  }, [state]);

  if (!state) return null;

  return (
    <TooltipPortal text={state.text} rect={state.rect} isVisible={isVisible} />
  );
}

function TooltipPortal({ text, rect, isVisible }: { text: string; rect: DOMRect; isVisible: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number; ready: boolean }>({ left: 0, top: 0, ready: false });

  useEffect(() => {
    if (!ref.current) return;
    const tooltipRect = ref.current.getBoundingClientRect();
    const gap = 6;
    
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    let top = rect.top - tooltipRect.height - gap;
    
    if (top < 8) {
      top = rect.bottom + gap;
    }
    
    const viewportWidth = window.innerWidth;
    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    
    setCoords({ left, top, ready: true });
  }, [rect]);

  return (
    <div
      ref={ref}
      className={`custom-tooltip ${isVisible && coords.ready ? 'custom-tooltip--visible' : ''}`}
      style={{
        position: 'fixed',
        left: `${coords.left}px`,
        top: `${coords.top}px`,
        visibility: coords.ready ? 'visible' : 'hidden',
        opacity: coords.ready && isVisible ? 1 : 0,
      }}
    >
      {text}
    </div>
  );
}
