export type RootStackParamList = {
  Startup: undefined;
  Home: undefined;
  Settings: undefined;
  ServerList: { errorMessage?: string } | undefined;
  Chat: { contactId: string; contactName: string };
  AddFriend: undefined;
  AddServer: undefined;
  Call:
    | {
        contactId: string;
        contactName: string;
        direction: 'outgoing';
      }
    | {
        contactId: string;
        contactName: string;
        direction: 'incoming';
        sdp: string;
        callId: string;
      };
};
