import {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  Dispatch,
  useEffect,
} from "react";

// Timer modes
export enum TimerMode {
  POMODORO = "pomodoro",
  SHORT_BREAK = "shortBreak",
  LONG_BREAK = "longBreak",
}

// Timer status
export enum TimerStatus {
  IDLE = "idle",
  RUNNING = "running",
  PAUSED = "paused",
  COMPLETED = "completed",
}

// Default durations in seconds
const DEFAULT_DURATIONS = {
  [TimerMode.POMODORO]: 25 * 60, // 25 minutes
  [TimerMode.SHORT_BREAK]: 5 * 60, // 5 minutes
  [TimerMode.LONG_BREAK]: 15 * 60, // 15 minutes
};

// Define the state shape
export interface TimerState {
  mode: TimerMode;
  status: TimerStatus;
  duration: number; // Duration in seconds
  timeRemaining: number; // Time remaining in seconds
  pomodorosCompleted: number;
  longBreakInterval: number; // After how many pomodoros to take a long break
  autoStartBreaks: boolean; // Whether to auto-start breaks
  autoStartPomodoros: boolean; // Whether to auto-start pomodoros after breaks
}

// Initial state
export const initialTimerState: TimerState = {
  mode: TimerMode.POMODORO,
  status: TimerStatus.IDLE,
  duration: DEFAULT_DURATIONS[TimerMode.POMODORO],
  timeRemaining: DEFAULT_DURATIONS[TimerMode.POMODORO],
  pomodorosCompleted: 0,
  longBreakInterval: 4, // Long break after 4 pomodoros
  autoStartBreaks: true,
  autoStartPomodoros: true,
};

// Define actions
export type TimerAction =
  | { type: "START_TIMER" }
  | { type: "PAUSE_TIMER" }
  | { type: "RESET_TIMER" }
  | { type: "TICK"; payload: number }
  | { type: "COMPLETE_TIMER" }
  | { type: "SET_MODE"; payload: TimerMode }
  | { type: "SET_DURATION"; payload: { mode: TimerMode; duration: number } }
  | { type: "SET_LONG_BREAK_INTERVAL"; payload: number }
  | { type: "SET_AUTO_START_BREAKS"; payload: boolean }
  | { type: "SET_AUTO_START_POMODOROS"; payload: boolean }
  | { type: "UPDATE_SETTINGS"; payload: Partial<TimerState> };

// Reducer function
function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "START_TIMER":
      return {
        ...state,
        status: TimerStatus.RUNNING,
      };
    case "PAUSE_TIMER":
      return {
        ...state,
        status: TimerStatus.PAUSED,
      };
    case "RESET_TIMER":
      return {
        ...state,
        status: TimerStatus.IDLE,
        timeRemaining: state.duration,
      };
    case "TICK":
      const newTimeRemaining = Math.max(0, state.timeRemaining - action.payload);
      
      // If timer reaches zero, mark as completed
      if (newTimeRemaining === 0 && state.status === TimerStatus.RUNNING) {
        return {
          ...state,
          timeRemaining: 0,
          status: TimerStatus.COMPLETED,
        };
      }
      
      return {
        ...state,
        timeRemaining: newTimeRemaining,
      };
    case "COMPLETE_TIMER":
      let newPomodorosCompleted = state.pomodorosCompleted;
      let nextMode = state.mode;
      
      // Update completed pomodoros count and determine next mode
      if (state.mode === TimerMode.POMODORO) {
        newPomodorosCompleted = state.pomodorosCompleted + 1;
        
        // Determine if we should take a long break or short break
        if (newPomodorosCompleted % state.longBreakInterval === 0) {
          nextMode = TimerMode.LONG_BREAK;
        } else {
          nextMode = TimerMode.SHORT_BREAK;
        }
      } else {
        // After a break, switch back to pomodoro
        nextMode = TimerMode.POMODORO;
      }
      
      // Get the duration for the next mode
      const nextDuration = DEFAULT_DURATIONS[nextMode];
      
      return {
        ...state,
        mode: nextMode,
        status: TimerStatus.IDLE,
        duration: nextDuration,
        timeRemaining: nextDuration,
        pomodorosCompleted: newPomodorosCompleted,
      };
    case "SET_MODE":
      return {
        ...state,
        mode: action.payload,
        duration: DEFAULT_DURATIONS[action.payload],
        timeRemaining: DEFAULT_DURATIONS[action.payload],
        status: TimerStatus.IDLE,
      };
    case "SET_DURATION":
      const { mode, duration } = action.payload;
      const newDurations = { ...DEFAULT_DURATIONS, [mode]: duration };
      
      // If this is the current mode, update current duration and time remaining
      if (mode === state.mode) {
        return {
          ...state,
          duration,
          timeRemaining: state.status === TimerStatus.IDLE ? duration : state.timeRemaining,
        };
      }
      
      return state;
    case "SET_LONG_BREAK_INTERVAL":
      return {
        ...state,
        longBreakInterval: action.payload,
      };
    case "SET_AUTO_START_BREAKS":
      return {
        ...state,
        autoStartBreaks: action.payload,
      };
    case "SET_AUTO_START_POMODOROS":
      return {
        ...state,
        autoStartPomodoros: action.payload,
      };
    case "UPDATE_SETTINGS":
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
}

// Create the context
interface TimerContextType {
  state: TimerState;
  dispatch: Dispatch<TimerAction>;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

// Provider component
interface TimerProviderProps {
  children: ReactNode;
}

export function TimerProvider({ children }: TimerProviderProps) {
  const [state, dispatch] = useReducer(timerReducer, initialTimerState);

  // Update page title based on timer state
  useEffect(() => {
    const { mode, timeRemaining, status } = state;
    
    // Only update title if timer is running or completed
    if (status === TimerStatus.RUNNING || status === TimerStatus.COMPLETED) {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      
      let title = '';
      
      switch (mode) {
        case TimerMode.POMODORO:
          title = `${timeString} - Focus Time`;
          break;
        case TimerMode.SHORT_BREAK:
          title = `${timeString} - Short Break`;
          break;
        case TimerMode.LONG_BREAK:
          title = `${timeString} - Long Break`;
          break;
      }
      
      document.title = title;
    } else {
      document.title = 'Chilly - Pomodoro Timer';
    }
    
    // Restore original title when component unmounts
    return () => {
      document.title = 'Chilly - Pomodoro Timer';
    };
  }, [state.timeRemaining, state.mode, state.status]);

  return (
    <TimerContext.Provider value={{ state, dispatch }}>
      {children}
    </TimerContext.Provider>
  );
}

// Custom hook to use the timer context
export function useTimer() {
  const context = useContext(TimerContext);
  
  if (context === undefined) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  
  return context;
} 