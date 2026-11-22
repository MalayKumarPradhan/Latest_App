import { Platform } from 'react-native';

import { syncBookingsApi } from './api';

const isWeb = Platform.OS === 'web';
const memoryStore = {
  session: null,
  pendingBookings: [],
};

let db = null;

async function getDb() {
  if (isWeb) {
    return null;
  }

  if (!db) {
    const sqlite = await import('expo-sqlite');
    db = sqlite.openDatabaseSync('busbooking.db');
  }

  return db;
}

function normalizeBookingRow(row) {
  return {
    id: row.id,
    booking_id: row.booking_id,
    ...JSON.parse(row.payload),
    status: row.status,
    created_at: row.created_at,
  };
}

export async function initOfflineStorage() {
  if (isWeb) {
    memoryStore.session = null;
    memoryStore.pendingBookings = [];
    return;
  }

  const dbConnection = await getDb();

  if (!dbConnection) {
    return;
  }

  await dbConnection.withTransactionAsync(async () => {
    await dbConnection.runAsync(`
      CREATE TABLE IF NOT EXISTS auth_session (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        user TEXT NOT NULL,
        token TEXT NOT NULL
      )
    `);

    await dbConnection.runAsync(`
      CREATE TABLE IF NOT EXISTS pending_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

export async function saveSession(session, persist = true) {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    memoryStore.session = persist ? {
      user: session.user,
      token: session.token,
      refreshToken: session.refreshToken,
    } : null;
    return;
  }

  const secureStore = await import('expo-secure-store');
  if (persist) {
    await secureStore.setItemAsync('auth_access_token', session.token);
    if (session.refreshToken) {
      await secureStore.setItemAsync('auth_refresh_token', session.refreshToken);
    } else {
      await secureStore.deleteItemAsync('auth_refresh_token');
    }
  } else {
    await secureStore.deleteItemAsync('auth_access_token');
    await secureStore.deleteItemAsync('auth_refresh_token');
    await secureStore.deleteItemAsync('auth_token');
  }

  await dbConnection.runAsync('DELETE FROM auth_session');
  if (persist) {
    await dbConnection.runAsync(
      'INSERT INTO auth_session (id, user, token) VALUES (?, ?, ?)',
      [1, JSON.stringify(session.user), '']
    );
  }
}

export async function getSession() {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    if (!memoryStore.session) {
      return null;
    }

    return {
      user: memoryStore.session.user,
      token: memoryStore.session.token,
      refreshToken: memoryStore.session.refreshToken,
    };
  }

  const row = await dbConnection.getFirstAsync(
    'SELECT user, token FROM auth_session WHERE id = 1'
  );

  if (!row) {
    return null;
  }

  const secureStore = await import('expo-secure-store');
  let token = await secureStore.getItemAsync('auth_access_token');
  let refreshToken = await secureStore.getItemAsync('auth_refresh_token');
  const legacyToken = await secureStore.getItemAsync('auth_token');
  if (!token && legacyToken) {
    token = legacyToken;
    await secureStore.setItemAsync('auth_access_token', token);
    await secureStore.deleteItemAsync('auth_token');
  }
  if (!token && row.token) {
    token = row.token;
    await secureStore.setItemAsync('auth_access_token', token);
  }
  if (row.token) {
    await dbConnection.runAsync('UPDATE auth_session SET token = ? WHERE id = 1', ['']);
  }
  if (!token || !refreshToken) {
    await secureStore.deleteItemAsync('auth_access_token');
    await secureStore.deleteItemAsync('auth_refresh_token');
    await secureStore.deleteItemAsync('auth_token');
    await dbConnection.runAsync('DELETE FROM auth_session');
    return null;
  }

  return {
    user: JSON.parse(row.user),
    token,
    refreshToken,
  };
}

export async function clearSession() {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    memoryStore.session = null;
    return;
  }

  const secureStore = await import('expo-secure-store');
  await secureStore.deleteItemAsync('auth_access_token');
  await secureStore.deleteItemAsync('auth_refresh_token');
  await secureStore.deleteItemAsync('auth_token');
  await dbConnection.runAsync('DELETE FROM auth_session');
}

export async function queueOfflineBooking(booking) {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    memoryStore.pendingBookings.push({
      id: booking.id,
      booking_id: booking.id,
      payload: JSON.stringify(booking),
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    return;
  }

  await dbConnection.runAsync(
    'INSERT INTO pending_bookings (booking_id, payload, status) VALUES (?, ?, ?)',
    [booking.id, JSON.stringify(booking), 'pending']
  );
}

export async function getPendingBookings() {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    return memoryStore.pendingBookings.map((row) => normalizeBookingRow(row));
  }

  const rows = await dbConnection.getAllAsync(
    'SELECT * FROM pending_bookings ORDER BY created_at DESC'
  );

  return rows.map((row) => normalizeBookingRow(row));
}

export async function markBookingSynced(bookingId) {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    memoryStore.pendingBookings = memoryStore.pendingBookings.map((booking) =>
      booking.booking_id === bookingId ? { ...booking, status: 'synced' } : booking
    );
    return;
  }

  await dbConnection.runAsync('UPDATE pending_bookings SET status = ? WHERE booking_id = ?', ['synced', bookingId]);
}

async function synchronizeBookings(bookings) {
  const response = await syncBookingsApi(bookings);
  const syncedCount = response.data?.synced;
  if (!Number.isSafeInteger(syncedCount) || syncedCount !== bookings.length) {
    throw new Error('The sync service did not confirm every queued booking.');
  }

  for (const booking of bookings) {
    await markBookingSynced(booking.booking_id || booking.id);
  }
  return response.data;
}

export async function syncPendingBookings() {
  const dbConnection = await getDb();

  if (isWeb || !dbConnection) {
    const bookings = await getPendingBookings();

    if (!bookings.length) {
      return { synced: 0, message: 'No queued bookings to synchronize.' };
    }

    return synchronizeBookings(bookings);
  }

  const bookings = await getPendingBookings();

  if (!bookings.length) {
    return { synced: 0, message: 'No queued bookings to synchronize.' };
  }

  return synchronizeBookings(bookings);
}
