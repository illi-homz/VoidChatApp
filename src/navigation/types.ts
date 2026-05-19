export type RootStackParamList = {
  Welcome: undefined;
  Home: undefined;
  Chat: { contactId: string; contactName: string };
  AddFriend: undefined;
  ShareId: undefined;
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
