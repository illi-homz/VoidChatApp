import React, { createContext, useContext } from 'react';
import { AppStore, appStore } from './AppStore';
import { ServerStore, serverStore } from './ServerStore';

const StoreContext = createContext<AppStore>(appStore);
const ServerContext = createContext<ServerStore>(serverStore);

export function StoreProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <StoreContext.Provider value={appStore}>
      <ServerContext.Provider value={serverStore}>{children}</ServerContext.Provider>
    </StoreContext.Provider>
  );
}

export function useStore(): AppStore {
  return useContext(StoreContext);
}

export function useServerStore(): ServerStore {
  return useContext(ServerContext);
}
