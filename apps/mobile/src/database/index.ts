import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import {
  List,
  ListItem,
  PriceSnapshot,
  Product,
  ReceiptUpload,
  SyncEvent
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'smart_shopper',
  jsi: true,
  onSetUpError(error) {
    console.error('Failed to initialise WatermelonDB', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [List, ListItem, Product, PriceSnapshot, ReceiptUpload, SyncEvent],
});

export async function resetDatabase() {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
}
