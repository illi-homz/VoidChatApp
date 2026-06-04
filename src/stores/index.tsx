import React, { createContext, useContext } from 'react';
import { AppStore, appStore } from './AppStore';
import { ServerStore, serverStore } from './ServerStore';
import { CallStore, callStore } from './CallStore';
import { VoicePlayerStore, voicePlayerStore } from './VoicePlayerStore';

const StoreContext = createContext<AppStore>(appStore);
const ServerContext = createContext<ServerStore>(serverStore);
const CallContext = createContext<CallStore>(callStore);
const VoicePlayerContext = createContext<VoicePlayerStore>(voicePlayerStore);

export function StoreProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <StoreContext.Provider value={appStore}>
      <ServerContext.Provider value={serverStore}>
        <CallContext.Provider value={callStore}>
          <VoicePlayerContext.Provider value={voicePlayerStore}>
            {children}
          </VoicePlayerContext.Provider>
        </CallContext.Provider>
      </ServerContext.Provider>
    </StoreContext.Provider>
  );
}

export function useStore(): AppStore {
  return useContext(StoreContext);
}

export function useServerStore(): ServerStore {
  return useContext(ServerContext);
}

export function useCallStore(): CallStore {
  return useContext(CallContext);
}

export function useVoicePlayerStore(): VoicePlayerStore {
  return useContext(VoicePlayerContext);
}
