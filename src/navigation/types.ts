import type { CallType } from '../types';

export type RootStackParamList = {
  Startup: undefined;
  Home: undefined;
  Settings: undefined;
  ServerList: { errorMessage?: string; returnToHome?: boolean } | undefined;
  Chat: { contactId: string; contactName: string };
  AddFriend: undefined;
  AddServer:
    | {
        inviterUserId?: string;
        autoFriend?: boolean;
        initialName?: string;
        initialHost?: string;
        initialPort?: string;
        // Deep link params (передаются через linking конфиг)
        host?: string;
        port?: string;
        user?: string;
        auto?: string | boolean;
      }
    | undefined;
  Call:
    | {
        contactId: string;
        contactName: string;
        direction: 'outgoing';
        callType: CallType;
      }
    | {
        contactId: string;
        contactName: string;
        direction: 'incoming';
        sdp: string;
        callId: string;
        callType: CallType;
      };
};
