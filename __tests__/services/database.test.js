// __tests__/database.test.js

jest.mock('better-sqlite3', () => {
    const ActualDatabase = jest.requireActual('better-sqlite3');
    // Selalu kembalikan database in-memory untuk setiap instance baru.
    return jest.fn().mockImplementation(() => new ActualDatabase(':memory:'));
  });
  
  // Membutuhkan modul SETELAH mock didefinisikan.
  const { setupDatabase, alertManager, db } = require('../../database');
  
  describe('Database and Alert Manager', () => {
  
    // Sebelum setiap tes, buat tabel di database in-memory yang baru.
    beforeEach(() => {
      setupDatabase();
    });
  
    // Setelah setiap tes, hapus semua data untuk memastikan tes berikutnya bersih.
    afterEach(() => {
      db.exec('DELETE FROM alerts');
    });
    
    test('should add an alert to the database', () => {
      const result = alertManager.addAlert('user1', 'guild1', 'Test Guild', 'tokenAddr1', 'TKN', 100, null);
      
      expect(result.changes).toBe(1);
      
      const alerts = alertManager.getAllAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].userId).toBe('user1');
    });
  
    test('should retrieve alerts for a specific user', () => {
      alertManager.addAlert('user1', 'guild1', 'Guild A', 'tokenAddr1', 'TKN1', 100, null);
      alertManager.addAlert('user2', 'guild1', 'Guild A', 'tokenAddr2', 'TKN2', 200, null);
      alertManager.addAlert('user1', 'guild2', 'Guild B', 'tokenAddr3', 'TKN3', null, 50);
  
      const user1Alerts = alertManager.getAlertsByUser('user1');
      expect(user1Alerts).toHaveLength(2);
    });
  
    test('should retrieve a specific alert by ID and user', () => {
      const added = alertManager.addAlert('user1', 'guild1', 'Guild A', 'tokenAddr1', 'TKN1', 100, null);
      const alertId = added.lastInsertRowid;
  
      const foundAlert = alertManager.getAlertByIdAndUser(alertId, 'user1');
      expect(foundAlert).toBeDefined();
      expect(foundAlert.id).toBe(alertId);
  
      const notFoundAlert = alertManager.getAlertByIdAndUser(alertId, 'user2');
      expect(notFoundAlert).toBeUndefined();
    });
  
    test('should remove an alert from the database', () => {
      const added = alertManager.addAlert('user1', 'guild1', 'Guild A', 'tokenAddr1', 'TKN1', 100, null);
      const alertId = added.lastInsertRowid;
      
      let allAlerts = alertManager.getAllAlerts();
      expect(allAlerts).toHaveLength(1);
  
      const removeResult = alertManager.removeAlert(alertId);
      expect(removeResult.changes).toBe(1);
  
      allAlerts = alertManager.getAllAlerts();
      expect(allAlerts).toHaveLength(0);
    });
  });
  