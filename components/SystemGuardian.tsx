
import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children?: ReactNode;
}

interface BotLog {
    id: string;
    msg: string;
    type: 'error' | 'process' | 'success';
}

interface GuardianState {
  hasCriticalError: boolean;
  active: boolean;
  logs: BotLog[];
  progress: number;
}

/**
 * SystemGuardian component provides a global error boundary and a "fixing" animation
 * for simulated system errors.
 */
// Fix: Extending Component directly from the named import ensures the TypeScript compiler correctly identifies 'state', 'setState', and 'props'.
export class SystemGuardian extends Component<Props, GuardianState> {
  constructor(props: Props) {
    super(props);
    // Properly initialize component state in constructor
    this.state = {
      hasCriticalError: false,
      active: false,
      logs: [],
      progress: 0
    };
  }

  componentDidMount() {
    // Listen for custom bot triggers (from services)
    window.addEventListener('geko-bot-trigger', this.handleBotTrigger);
    
    // Listen for unhandled promise rejections (Network/Async errors)
    window.addEventListener('unhandledrejection', this.handleAsyncError);
  }

  componentWillUnmount() {
    window.removeEventListener('geko-bot-trigger', this.handleBotTrigger);
    window.removeEventListener('unhandledrejection', this.handleAsyncError);
  }

  static getDerivedStateFromError(_: Error): Partial<GuardianState> {
    return { hasCriticalError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical System Failure:", error, errorInfo);
    this.triggerFixSequence("KERNEL_PANIC", "Rendering engine stalled. Hard resetting...");
  }

  handleAsyncError = (event: PromiseRejectionEvent) => {
    // Handle async failures by triggering the fix sequence
    this.triggerFixSequence("ASYNC_EXCEPTION", "Uncaught promise detected. Patching...");
  };

  handleBotTrigger = (event: Event) => {
    // Cast to CustomEvent to access detail safely for bot-driven triggers
    const customEvent = event as CustomEvent;
    if (customEvent.detail) {
        const { type, message } = customEvent.detail;
        this.triggerFixSequence(type, message);
    }
  };

  /**
   * Triggers the sequence to "fix" the system state with a progress bar and logs.
   */
  triggerFixSequence = (code: string, message: string) => {
    // Correctly access state via this.state
    if (this.state.active) return; // Already fixing

    // Correctly use this.setState to update internal status
    this.setState({
      active: true,
      logs: [{ id: '1', msg: `ALERT: ${code} DETECTED`, type: 'error' }],
      progress: 5
    });

    // Sequence of "Fixing" animations using timeouts
    setTimeout(() => this.addLog(`ANALYSIS: ${message}`, 'process', 20), 800);
    setTimeout(() => this.addLog("ACTION: Rerouting via backup nodes...", 'process', 45), 1600);
    setTimeout(() => this.addLog("OPTIMIZING: Clearing memory heap...", 'process', 70), 2400);
    setTimeout(() => this.addLog("SUCCESS: Systems normalized.", 'success', 100), 3200);

    // Reset Sequence to restore the application
    setTimeout(() => {
        this.setState({ active: false, hasCriticalError: false, logs: [], progress: 0 });
    }, 4500);
  };

  /**
   * Helper to append logs to the fix sequence state.
   */
  addLog = (msg: string, type: BotLog['type'], progress: number) => {
    // Correctly use this.setState for functional state updates
    this.setState((prev) => ({
        logs: [...prev.logs, { id: Date.now().toString(), msg, type }],
        progress
    }));
  };

  render() {
    // Explicitly access state properties from this.state
    const { hasCriticalError, progress } = this.state;

    if (hasCriticalError) {
       return (
         <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center font-mono text-center p-4">
            <div className="w-24 h-24 relative mb-8">
                <div className="absolute inset-0 border-4 border-indigo-500/30 rounded-full animate-ping"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">⚠️</div>
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-2">System Failure</h1>
            <p className="text-gray-500 text-xs mb-8">Reconstructing the DOM tree...</p>
            
            <div className="w-64 h-1.5 bg-gray-900 rounded-full overflow-hidden relative">
                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
         </div>
       );
    }

    // Correctly access children from this.props
    return (
      <>
        {this.props.children}
      </>
    );
  }
}
