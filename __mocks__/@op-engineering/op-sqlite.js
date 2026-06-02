// __mocks__/@op-engineering/op-sqlite.js

const mockDb = {
  execute: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
  executeSync: jest.fn().mockReturnValue({ rows: [], rowsAffected: 0 }),
  executeBatch: jest.fn().mockResolvedValue({ rowsAffected: 0 }),
  transaction: jest.fn(async (callback) => {
    const tx = {
      execute: jest.fn().mockResolvedValue({ rows: [], rowsAffected: 0 }),
    };
    await callback(tx);
  }),
  reactiveExecute: jest.fn().mockReturnValue(jest.fn()), // returns unsubscribe
  prepareStatement: jest.fn().mockReturnValue({
    bind: jest.fn().mockResolvedValue(undefined),
    bindSync: jest.fn(),
    execute: jest.fn().mockResolvedValue({ rows: [] }),
  }),
  close: jest.fn().mockResolvedValue(undefined),
  updateHook: jest.fn(),
};

export const open = jest.fn().mockReturnValue(mockDb);
export const moveAssetsDatabase = jest.fn().mockResolvedValue(true);
export const ANDROID_DATABASE_PATH = '/data/data/com.voidchatapp/databases';
export const IOS_LIBRARY_PATH = '/var/mobile/Containers/Data/Application/Documents';

export default { open, moveAssetsDatabase, ANDROID_DATABASE_PATH, IOS_LIBRARY_PATH };
