/* ================================================================
   Fit — GitPanel Component (Extracted from FileDrawer)
   Global state management with granular re-render control.
   Zero external dependencies.
   ================================================================ */

import React, { useState, useCallback, useEffect, useRef, memo } from 'react';
import { useAppSelector, useAppDispatch, useGitStatus, useWorkspaces, useActiveWorkspaceId } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { getFileIcon } from '../../utils/fileIcons';
import { 
  gitStage, 
  gitUnstage, 
  gitStageAll, 
  gitUnstageAll, 
  gitCommit, 
  gitPush, 
  gitPull, 
  gitFetch, 
  gitDiscardFile,
  gitRunCommand
} from '../../utils/ipc';
import type { GitFileStatus } from '../../types';
import { MoreHorizontal, ChevronRight } from 'lucide-react';

const GitPanelItem = memo(({
  file,
  isStaged,
  onItemClick,
  onOpenFile,
  onAction,
  onDiscard,
  t
}: {
  file: GitFileStatus;
  isStaged: boolean;
  onItemClick: (path: string) => void;
  onOpenFile: (path: string) => void;
  onAction: (path: string) => void;
  onDiscard?: (path: string) => void;
  t: any;
}) => {
  const fileIcon = getFileIcon(file.name);
  const displayDir = file.path.replace(/\\/g, '/').substring(0, Math.max(0, file.path.replace(/\\/g, '/').lastIndexOf(file.name))).replace(/^\/|\/$/g, '');
  
  return (
    <div className="git-panel__change-item">
      <span className="git-panel__item-icon" style={{ color: fileIcon.color }}>{fileIcon.icon}</span>
      <div 
        className="git-panel__item-details" 
        onClick={() => onItemClick(file.path)}
        style={{ cursor: 'pointer' }}
      >
        <span className="git-panel__item-name">{file.name}</span>
        {displayDir && <span className="git-panel__item-path">{displayDir}</span>}
      </div>
      <span className={`git-panel__item-status git-panel__item-status--${file.status}`}>
        {file.status === 'untracked' ? 'U' : file.status[0].toUpperCase()}
      </span>
      <div className="git-panel__item-actions">
        <button className="git-panel__action-btn" onClick={() => onOpenFile(file.path)} title={t('git.openFile')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
        {isStaged ? (
          <button className="git-panel__action-btn" onClick={() => onAction(file.path)} title={t('git.unstage')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        ) : (
          <>
            {onDiscard && (
              <button className="git-panel__action-btn" onClick={() => onDiscard(file.path)} title={t('git.discard')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              </button>
            )}
            <button className="git-panel__action-btn" onClick={() => onAction(file.path)} title={t('git.stage')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

const PLACEHOLDER_COMMITS = [
  "fix: resolve cursor misalignment in terminal",
  "feat: implement keyboard navigation for file tree",
  "style: adjust badge padding and colors",
  "refactor: optimize rendering of tree items",
  "docs: update installation instructions",
  "chore: bump dependencies to latest versions",
  "fix: prevent duplicate git status poll",
  "feat: add context menu for left sidebar sessions",
  "style: unify design system tokens in index.css",
  "fix: hide inactive cursor box on terminal blur",
  "feat: add stage all and unstage all buttons",
  "refactor: simplify state transitions in AppStore",
  "fix: handle special characters in branch names",
  "docs: add architectural diagram to DESIGN.md",
  "perf: reduce re-renders of GitPanel items",
  "feat: support custom key bindings for editor",
  "fix: close tabs of deleted directories",
  "style: polish hover transitions for sidebars",
  "feat: implement search filter debounce",
  "fix: typecheck errors in ipc communications",
  "chore: clean up unused css rules in index.css",
  "feat: support drag and drop file movements",
  "fix: restore layout states on window reload",
  "refactor: extract terminal panel component",
  "docs: translate context menu options",
  "fix: styling of disabled buttons in settings",
  "feat: add system diagnostic commands",
  "perf: memoize expensive tree path lookups",
  "style: make selection badges rounded white",
  "fix: prevent scrollbars overlapping menus",
  "feat: support multiple active tauri sessions",
  "refactor: rename variables for clarity",
  "docs: document active keyboard shortcuts",
  "fix: border colors of edit modal input",
  "feat: add command history logging",
  "style: update settings modal overlay style",
  "fix: race conditions during git checkout",
  "feat: add markdown link preview support",
  "refactor: simplify context menu rendering",
  "docs: write comprehensive api comments",
  "fix: prevent event propagation on rename blur",
  "feat: support dark and light theme toggling",
  "style: align close tab icons in tab bar",
  "fix: path separator normalization for Windows",
  "feat: implement visual diff side-by-side view",
  "refactor: modularize file drawer actions",
  "docs: add changelog details for release",
  "fix: terminal font rendering issues",
  "feat: add auto-save options to settings",
  "style: rounded corners for all select inputs"
];

export function GitPanel() {
  const { t } = useTranslation();
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();
  const status = useGitStatus();
  const dispatch = useAppDispatch();
  const [commitMessage, setCommitMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [placeholder, setPlaceholder] = useState('');

  // Git menu dropdown & submenus
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  // Input dialog modals
  const [dialogType, setDialogType] = useState<'clone' | 'checkout' | 'commit-message' | 'branch-create' | 'branch-delete' | 'branch-switch' | 'remote-add' | 'remote-remove' | 'stash-push' | 'tag-create' | 'tag-delete' | null>(null);
  const [dialogInput1, setDialogInput1] = useState('');
  const [dialogInput2, setDialogInput2] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    let currentMsgIndex = Math.floor(Math.random() * PLACEHOLDER_COMMITS.length);
    let currentCharIndex = 0;
    let isDeleting = false;
    let timeoutId: any;

    const tick = () => {
      const currentFullText = PLACEHOLDER_COMMITS[currentMsgIndex];

      if (isDeleting) {
        setPlaceholder(currentFullText.substring(0, currentCharIndex));
        currentCharIndex--;

        if (currentCharIndex < 0) {
          isDeleting = false;
          currentCharIndex = 0;
          currentMsgIndex = (currentMsgIndex + 1) % PLACEHOLDER_COMMITS.length;
          timeoutId = setTimeout(tick, 500);
        } else {
          timeoutId = setTimeout(tick, 30);
        }
      } else {
        setPlaceholder(currentFullText.substring(0, currentCharIndex + 1));
        currentCharIndex++;

        if (currentCharIndex === currentFullText.length) {
          isDeleting = true;
          timeoutId = setTimeout(tick, 2500);
        } else {
          timeoutId = setTimeout(tick, 60);
        }
      }
    };

    timeoutId = setTimeout(tick, 500);
    return () => clearTimeout(timeoutId);
  }, []);

  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setActiveSubmenu(null);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const handleRefreshClick = useCallback(async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    if (activeWorkspace) {
      try {
        const { gitStatus: gitStatusFn } = await import('../../utils/ipc');
        const res = await gitStatusFn(activeWorkspace.path);
        dispatch({ type: 'SET_GIT_STATUS', payload: res });
      } catch (err) {
        console.error('Failed to refresh git status:', err);
      }
    }
    setTimeout(() => {
      setIsSpinning(false);
    }, 600);
  }, [activeWorkspace, isSpinning, dispatch]);

  const handleOpenFile = useCallback((fileRelPath: string) => {
    if (!activeWorkspace) return;
    const absPath = `${activeWorkspace.path}/${fileRelPath}`.replace(/\\/g, '/');
    const fileName = fileRelPath.substring(fileRelPath.lastIndexOf('/') + 1);
    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: `tab-editor-${absPath}`,
        type: 'editor',
        title: fileName,
        filePath: absPath,
      },
    });
  }, [activeWorkspace, dispatch]);

  const handleItemClick = useCallback((fileRelPath: string) => {
    if (!activeWorkspace) return;
    const absPath = `${activeWorkspace.path}/${fileRelPath}`.replace(/\\/g, '/');
    const fileName = fileRelPath.substring(fileRelPath.lastIndexOf('/') + 1);

    const ext = fileName.split('.').pop()?.toLowerCase();
    const isImage = ext ? ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg', 'tiff', 'tif', 'avif', 'apng'].includes(ext) : false;

    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: isImage ? `tab-editor-${absPath}` : `tab-diff-${absPath}`,
        type: isImage ? 'editor' : 'diff',
        title: fileName,
        filePath: absPath,
      },
    });
  }, [activeWorkspace, dispatch]);

  useEffect(() => {
    setCommitMessage('');
    setError(null);
  }, [activeWorkspaceId]);

  const refresh = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const { gitStatus: gitStatusFn } = await import('../../utils/ipc');
      const res = await gitStatusFn(activeWorkspace.path);
      dispatch({ type: 'SET_GIT_STATUS', payload: res });
    } catch (err) {
      console.error('Failed to refresh git status:', err);
    }
  }, [activeWorkspace, dispatch]);

  const handleDiscard = useCallback(async (fileRelPath: string) => {
    if (!activeWorkspace) return;
    try {
      await gitDiscardFile(activeWorkspace.path, fileRelPath);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleStage = useCallback(async (file: string) => {
    if (!activeWorkspace) return;
    try {
      await gitStage(activeWorkspace.path, file);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleUnstage = useCallback(async (file: string) => {
    if (!activeWorkspace) return;
    try {
      await gitUnstage(activeWorkspace.path, file);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleStageAll = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      await gitStageAll(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleUnstageAll = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      await gitUnstageAll(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleCommit = useCallback(async () => {
    if (!activeWorkspace || !commitMessage.trim()) return;
    setActionLoading('commit');
    try {
      await gitCommit(activeWorkspace.path, commitMessage);
      setCommitMessage('');
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, commitMessage, refresh]);

  const handlePush = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('push');
    try {
      await gitPush(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handlePull = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('pull');
    try {
      await gitPull(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleFetch = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('fetch');
    try {
      await gitFetch(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    }
  }, [handleCommit]);

  const handleGitActionNoInput = useCallback(async (actionName: string, args: string[]) => {
    if (!activeWorkspace) return;
    setMenuOpen(false);
    setActiveSubmenu(null);
    setActionLoading(actionName);
    try {
      await gitRunCommand(activeWorkspace.path, args);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleDiscardAll = useCallback(async () => {
    if (!activeWorkspace) return;
    setMenuOpen(false);
    setActiveSubmenu(null);
    setActionLoading('discard-all');
    try {
      await gitRunCommand(activeWorkspace.path, ["checkout", "--", "."]);
      await gitRunCommand(activeWorkspace.path, ["clean", "-fd"]);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleSync = useCallback(async () => {
    if (!activeWorkspace) return;
    setMenuOpen(false);
    setActiveSubmenu(null);
    setActionLoading('sync');
    try {
      await gitPull(activeWorkspace.path);
      await gitPush(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleInitializeRepo = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('init');
    try {
      await gitRunCommand(activeWorkspace.path, ["init"]);
      try {
        await gitRunCommand(activeWorkspace.path, ["checkout", "-b", "main"]);
      } catch (e) {
        // Ignore if checkout fails on empty repo
      }
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const triggerCommitAction = useCallback(async (type: 'staged' | 'all' | 'amend-staged' | 'amend-all') => {
    if (!activeWorkspace) return;
    setMenuOpen(false);
    setActiveSubmenu(null);
    if (commitMessage.trim()) {
      setActionLoading('commit');
      try {
        if (type === 'all') {
          await gitRunCommand(activeWorkspace.path, ["commit", "-a", "-m", commitMessage.trim()]);
        } else if (type === 'amend-staged') {
          await gitRunCommand(activeWorkspace.path, ["commit", "--amend", "-m", commitMessage.trim()]);
        } else if (type === 'amend-all') {
          await gitRunCommand(activeWorkspace.path, ["commit", "-a", "--amend", "-m", commitMessage.trim()]);
        } else {
          await gitCommit(activeWorkspace.path, commitMessage.trim());
        }
        setCommitMessage('');
        await refresh();
        setError(null);
      } catch (err) {
        setError(String(err));
      } finally {
        setActionLoading(null);
      }
    } else {
      setDialogType('commit-message');
      setDialogInput1('');
      setDialogInput2(type);
    }
  }, [activeWorkspace, commitMessage, refresh]);

  const handleDialogSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeWorkspace) return;
    setDialogLoading(true);
    setError(null);
    try {
      switch (dialogType) {
        case 'clone': {
          if (!dialogInput1.trim() || !dialogInput2.trim()) {
            throw new Error("URL and directory name are required");
          }
          const parentDir = activeWorkspace.path.substring(0, Math.max(activeWorkspace.path.lastIndexOf('/'), activeWorkspace.path.lastIndexOf('\\')));
          await gitRunCommand(parentDir, ["clone", dialogInput1.trim(), dialogInput2.trim()]);
          break;
        }
        case 'checkout': {
          if (!dialogInput1.trim()) throw new Error("Branch/Ref is required");
          await gitRunCommand(activeWorkspace.path, ["checkout", dialogInput1.trim()]);
          break;
        }
        case 'branch-create': {
          if (!dialogInput1.trim()) throw new Error("Branch name is required");
          await gitRunCommand(activeWorkspace.path, ["checkout", "-b", dialogInput1.trim()]);
          break;
        }
        case 'branch-delete': {
          if (!dialogInput1.trim()) throw new Error("Branch name is required");
          await gitRunCommand(activeWorkspace.path, ["branch", "-d", dialogInput1.trim()]);
          break;
        }
        case 'branch-switch': {
          if (!dialogInput1.trim()) throw new Error("Branch name is required");
          await gitRunCommand(activeWorkspace.path, ["checkout", dialogInput1.trim()]);
          break;
        }
        case 'remote-add': {
          if (!dialogInput1.trim() || !dialogInput2.trim()) {
            throw new Error("Name and URL are required");
          }
          await gitRunCommand(activeWorkspace.path, ["remote", "add", dialogInput1.trim(), dialogInput2.trim()]);
          break;
        }
        case 'remote-remove': {
          if (!dialogInput1.trim()) throw new Error("Remote name is required");
          await gitRunCommand(activeWorkspace.path, ["remote", "remove", dialogInput1.trim()]);
          break;
        }
        case 'stash-push': {
          const msg = dialogInput1.trim();
          const args = msg ? ["stash", "push", "-m", msg] : ["stash", "push"];
          await gitRunCommand(activeWorkspace.path, args);
          break;
        }
        case 'tag-create': {
          if (!dialogInput1.trim()) throw new Error("Tag name is required");
          const msg = dialogInput2.trim();
          const args = msg ? ["tag", "-a", dialogInput1.trim(), "-m", msg] : ["tag", dialogInput1.trim()];
          await gitRunCommand(activeWorkspace.path, args);
          break;
        }
        case 'tag-delete': {
          if (!dialogInput1.trim()) throw new Error("Tag name is required");
          await gitRunCommand(activeWorkspace.path, ["tag", "-d", dialogInput1.trim()]);
          break;
        }
        case 'commit-message': {
          if (!dialogInput1.trim()) throw new Error("Commit message is required");
          const commitType = dialogInput2;
          if (commitType === 'all') {
            await gitRunCommand(activeWorkspace.path, ["commit", "-a", "-m", dialogInput1.trim()]);
          } else if (commitType === 'amend-staged') {
            await gitRunCommand(activeWorkspace.path, ["commit", "--amend", "-m", dialogInput1.trim()]);
          } else if (commitType === 'amend-all') {
            await gitRunCommand(activeWorkspace.path, ["commit", "-a", "--amend", "-m", dialogInput1.trim()]);
          } else {
            await gitCommit(activeWorkspace.path, dialogInput1.trim());
          }
          break;
        }
      }
      setDialogType(null);
      setDialogInput1('');
      setDialogInput2('');
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setDialogLoading(false);
    }
  };

  if (!status) {
    return (
      <div className="git-panel git-panel--uninitialized">
        <p className="git-panel__uninit-text">{t('git.uninitialized')}</p>
        <button 
          className="git-panel__init-btn" 
          onClick={handleInitializeRepo}
          disabled={actionLoading === 'init'}
        >
          {actionLoading === 'init' ? "Initializing..." : t('git.initialize')}
        </button>
      </div>
    );
  }

  const totalChanges = status.staged.length + status.unstaged.length;

  return (
    <div className="git-panel">
      <div className="git-panel__header">
        <div className="git-panel__actions">
          <button className="git-panel__header-btn" onClick={handlePull} disabled={!!actionLoading} title={t('git.pull')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16z" />
              <path d="M12 16a2.5 2.5 0 0 1 0-5 3 3 0 0 1 3.5.5A2 2 0 0 1 17 13.5a2.5 2.5 0 0 1-2.5 2.5h-2.5z" />
            </svg>
          </button>
          <button className="git-panel__header-btn" onClick={handleFetch} disabled={!!actionLoading} title={t('git.fetch')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button className="git-panel__header-btn" onClick={handleRefreshClick} title={t('git.refresh')}>
            <svg 
              className={isSpinning ? 'git-panel__refresh-icon--spinning' : ''} 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          

        </div>
      </div>

      {error && (
        <div className="git-panel__error-banner">
          <span className="git-panel__error-text">{error}</span>
          <button className="git-panel__error-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="git-panel__commit-container">
        <div className="git-panel__textarea-wrapper">
          <textarea
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            className="git-panel__textarea"
            placeholder={placeholder}
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            disabled={!!actionLoading}
            style={{
              overflowY: 'hidden',
              minHeight: '56px',
            }}
          />
        </div>

        <div className="git-panel__commit-status">
          <span>
            {status.staged.length > 0
              ? t('git.staged', { count: status.staged.length })
              : t('git.noStaged')}
          </span>
          <span className="git-panel__remote-info">origin/{status.branch}</span>
        </div>

        <div className="git-panel__action-row">
          <button
            className="git-panel__btn git-panel__btn--commit"
            onClick={handleCommit}
            disabled={status.staged.length === 0 || !commitMessage.trim() || !!actionLoading}
          >
            {actionLoading === 'commit' ? t('git.committing') : t('git.commit')}
          </button>
          <button
            className="git-panel__btn git-panel__btn--push"
            onClick={handlePush}
            disabled={!!actionLoading}
          >
            {actionLoading === 'push' ? t('git.pushing') : t('git.push')}
          </button>
        </div>
      </div>

      <div className="git-panel__content">
        {totalChanges === 0 && (!status.aheadCommits || status.aheadCommits.length === 0) ? (
          <div className="git-panel__section git-panel__section--clean">
            <p className="git-panel__clean-message">{t('git.noChanges')}</p>
          </div>
        ) : (
          <>
            {status.staged.length > 0 && (
              <div className="git-panel__section">
                <div className="git-panel__section-header">
                  <div className="git-panel__section-title">
                    <span>{t('git.stagedChanges')}</span>
                    <span className="git-panel__badge">{status.staged.length}</span>
                  </div>
                  <button 
                    className="git-panel__section-header-btn" 
                    onClick={handleUnstageAll} 
                    type="button"
                  >
                    {t('git.unstageAllShort')}
                  </button>
                </div>
                <div className="git-panel__section-list">
                  {status.staged.map((file) => (
                    <GitPanelItem
                      key={`staged-${file.path}`}
                      file={file}
                      isStaged={true}
                      onItemClick={handleItemClick}
                      onOpenFile={handleOpenFile}
                      onAction={handleUnstage}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {status.unstaged.length > 0 && (
              <div className="git-panel__section">
                <div className="git-panel__section-header">
                  <div className="git-panel__section-title">
                    <span>{t('git.changes')}</span>
                    <span className="git-panel__badge">{status.unstaged.length}</span>
                  </div>
                  <button 
                    className="git-panel__section-header-btn" 
                    onClick={handleStageAll} 
                    type="button"
                  >
                    {t('git.addAll')}
                  </button>
                </div>
                <div className="git-panel__section-list">
                  {status.unstaged.map((file) => (
                    <GitPanelItem
                      key={`unstaged-${file.path}`}
                      file={file}
                      isStaged={false}
                      onItemClick={handleItemClick}
                      onOpenFile={handleOpenFile}
                      onAction={handleStage}
                      onDiscard={handleDiscard}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {status.aheadCommits && status.aheadCommits.length > 0 && (
              <div className="git-panel__section git-panel__section--ahead">
                <div className="git-panel__section-header">
                  <div className="git-panel__section-title">
                    <span>
                      {t('git.unsyncedCommits', { count: status.aheadCommits.length }) || 
                       `UNSYNCED COMMITS (${status.aheadCommits.length})`}
                    </span>
                  </div>
                </div>
                <div className="git-panel__section-list">
                  {status.aheadCommits.map((commit) => (
                    <div key={commit.hash} className="git-panel__commit-item">
                      <span className="git-panel__commit-icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <line x1="12" y1="1" x2="12" y2="9" />
                          <line x1="12" y1="15" x2="12" y2="23" />
                        </svg>
                      </span>
                      <div className="git-panel__commit-details">
                        <span className="git-panel__commit-msg">{commit.message}</span>
                        <span className="git-panel__commit-meta">
                          {commit.hash.substring(0, 7)} • {commit.author} • {commit.date}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {dialogType && (
        <div className="git-modal-overlay" onClick={() => { setDialogType(null); setDialogInput1(''); setDialogInput2(''); }}>
          <div className="git-modal" onClick={e => e.stopPropagation()}>
            <form className="git-modal__content" onSubmit={handleDialogSubmit}>
            <div className="git-modal__header">
              <span className="git-modal__title">
                {dialogType === 'clone' && "Clone Repository"}
                {dialogType === 'checkout' && "Checkout Ref"}
                {dialogType === 'branch-create' && "Create Branch"}
                {dialogType === 'branch-delete' && "Delete Branch"}
                {dialogType === 'branch-switch' && "Switch to Branch"}
                {dialogType === 'remote-add' && "Add Remote"}
                {dialogType === 'remote-remove' && "Remove Remote"}
                {dialogType === 'stash-push' && "Stash Changes"}
                {dialogType === 'tag-create' && "Create Tag"}
                {dialogType === 'tag-delete' && "Delete Tag"}
                {dialogType === 'commit-message' && "Commit Message"}
              </span>
            </div>

            {dialogType === 'clone' && (
              <>
                <div>
                  <label className="git-modal__label">Repository URL</label>
                  <input 
                    className="git-modal__input" 
                    placeholder="https://github.com/user/repo.git"
                    value={dialogInput1} 
                    onChange={e => setDialogInput1(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="git-modal__label">Directory Name</label>
                  <input 
                    className="git-modal__input" 
                    placeholder="my-repo"
                    value={dialogInput2} 
                    onChange={e => setDialogInput2(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {dialogType === 'checkout' && (
              <div>
                <label className="git-modal__label">Ref (Branch, Tag, or Commit SHA)</label>
                <input 
                  className="git-modal__input" 
                  placeholder="main"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'branch-create' && (
              <div>
                <label className="git-modal__label">New Branch Name</label>
                <input 
                  className="git-modal__input" 
                  placeholder="feature/new-feature"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'branch-delete' && (
              <div>
                <label className="git-modal__label">Branch Name</label>
                <input 
                  className="git-modal__input" 
                  placeholder="feature/old-feature"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'branch-switch' && (
              <div>
                <label className="git-modal__label">Branch Name</label>
                <input 
                  className="git-modal__input" 
                  placeholder="main"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'remote-add' && (
              <>
                <div>
                  <label className="git-modal__label">Remote Name</label>
                  <input 
                    className="git-modal__input" 
                    placeholder="origin"
                    value={dialogInput1} 
                    onChange={e => setDialogInput1(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="git-modal__label">Remote URL</label>
                  <input 
                    className="git-modal__input" 
                    placeholder="https://github.com/user/repo.git"
                    value={dialogInput2} 
                    onChange={e => setDialogInput2(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {dialogType === 'remote-remove' && (
              <div>
                <label className="git-modal__label">Remote Name</label>
                <input 
                  className="git-modal__input" 
                  placeholder="origin"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'stash-push' && (
              <div>
                <label className="git-modal__label">Stash Message (Optional)</label>
                <input 
                  className="git-modal__input" 
                  placeholder="Work in progress"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'commit-message' && (
              <div>
                <label className="git-modal__label">Commit Message</label>
                <input 
                  className="git-modal__input" 
                  placeholder="Initial commit"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            {dialogType === 'tag-create' && (
              <>
                <div>
                  <label className="git-modal__label">Tag Name</label>
                  <input 
                    className="git-modal__input" 
                    placeholder="v1.0.0"
                    value={dialogInput1} 
                    onChange={e => setDialogInput1(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="git-modal__label">Message (Optional)</label>
                  <input 
                    className="git-modal__input" 
                    placeholder="Release v1.0.0"
                    value={dialogInput2} 
                    onChange={e => setDialogInput2(e.target.value)}
                  />
                </div>
              </>
            )}

            {dialogType === 'tag-delete' && (
              <div>
                <label className="git-modal__label">Tag Name</label>
                <input 
                  className="git-modal__input" 
                  placeholder="v1.0.0"
                  value={dialogInput1} 
                  onChange={e => setDialogInput1(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            <div className="git-modal__actions">
              <button 
                type="button" 
                className="git-modal__btn git-modal__btn--cancel" 
                onClick={() => { setDialogType(null); setDialogInput1(''); setDialogInput2(''); }}
                disabled={dialogLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="git-modal__btn git-modal__btn--confirm"
                disabled={dialogLoading}
              >
                {dialogLoading ? "Executing..." : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
