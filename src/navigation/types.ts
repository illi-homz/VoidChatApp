import type { CallType } from '../types';

export type RootStackParamList = {
  Startup: undefined;
  Home: undefined;
  Settings: undefined;
  ServerList: { errorMessage?: string; returnToHome?: boolean } | undefined;
  Chat: { contactId: string; contactName: string };
  AddFriend: undefined;
  AddServer: undefined;
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
