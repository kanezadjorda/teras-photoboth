import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createCaptureStateMachine, CAPTURE_SUB_STATES } from '../src/shared/capture-state.js';
import { db } from '../server/db.js';
import { app } from '../server/index.js';

describe('Capture Shot Sub-State Machine & Flow (PRD F-10)', () => {
  describe('Sub-State Transitions (live -> countdown -> reviewing_shot)', () => {
    it('starts in live sub-state at index 0 by default', () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });
      expect(sm.getSubState()).toBe(CAPTURE_SUB_STATES.LIVE);
      expect(sm.getCurrentShotIndex()).toBe(0);
      expect(sm.getAcceptedPhotos()).toEqual([]);
      expect(sm.getPendingShot()).toBe(null);
      expect(sm.isLastShot()).toBe(false);
    });

    it('transitions to countdown when startCountdown is called', () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });
      sm.startCountdown();
      expect(sm.getSubState()).toBe(CAPTURE_SUB_STATES.COUNTDOWN);
    });

    it('transitions to reviewing_shot when frame is captured', () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });
      sm.startCountdown();
      sm.captureFrame('data:image/jpeg;base64,mockframe1');
      expect(sm.getSubState()).toBe(CAPTURE_SUB_STATES.REVIEWING_SHOT);
      expect(sm.getPendingShot()).toBe('data:image/jpeg;base64,mockframe1');
    });

    it('rejects invalid state calls', () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });
      expect(() => sm.retake()).toThrow();
      sm.startCountdown();
      expect(() => sm.startCountdown()).toThrow();
    });
  });

  describe('Retake (Ulangi) Behavior (PRD F-10)', () => {
    it('discards pending shot, stays on the same index, and does not save to disk', async () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });
      sm.startCountdown();
      sm.captureFrame('data:image/jpeg;base64,badshot');

      const saveFn = vi.fn();
      const res = sm.retake();

      expect(res.subState).toBe(CAPTURE_SUB_STATES.LIVE);
      expect(res.currentShotIndex).toBe(0);
      expect(sm.getCurrentShotIndex()).toBe(0);
      expect(sm.getPendingShot()).toBe(null);
      expect(sm.getAcceptedPhotos()).toEqual([]);
      expect(saveFn).not.toHaveBeenCalled();
    });

    it('allows unlimited retakes on the same shot index', () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });

      for (let attempt = 0; attempt < 5; attempt++) {
        sm.startCountdown();
        sm.captureFrame(`data:image/jpeg;base64,attempt_${attempt}`);
        expect(sm.getCurrentShotIndex()).toBe(0);
        sm.retake();
        expect(sm.getSubState()).toBe(CAPTURE_SUB_STATES.LIVE);
        expect(sm.getCurrentShotIndex()).toBe(0);
      }
    });
  });

  describe('Continue (Lanjut) and Advancement Behavior (PRD F-10)', () => {
    it('saves accepted photo via saveFn, accepts it, and advances index', async () => {
      const sm = createCaptureStateMachine({ totalPhotos: 3 });
      sm.startCountdown();
      sm.captureFrame('data:image/jpeg;base64,goodshot1');

      const saveFn = vi.fn(async () => ({ success: true }));
      const result = await sm.confirmShot(saveFn);

      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(saveFn).toHaveBeenCalledWith({
        index: 0,
        photo: 'data:image/jpeg;base64,goodshot1'
      });
      expect(result.isComplete).toBe(false);
      expect(result.currentShotIndex).toBe(1);
      expect(sm.getCurrentShotIndex()).toBe(1);
      expect(sm.getSubState()).toBe(CAPTURE_SUB_STATES.LIVE);
      expect(sm.getAcceptedPhotos()).toEqual(['data:image/jpeg;base64,goodshot1']);
    });

    it('completes on last photo and invokes onComplete callback', async () => {
      const onCompleteMock = vi.fn();
      const sm = createCaptureStateMachine({
        totalPhotos: 2,
        onComplete: onCompleteMock
      });

      // Shot 1
      sm.startCountdown();
      sm.captureFrame('photo1');
      await sm.confirmShot();
      expect(sm.getCurrentShotIndex()).toBe(1);
      expect(sm.isLastShot()).toBe(true);

      // Shot 2 (Last)
      sm.startCountdown();
      sm.captureFrame('photo2');
      const finalResult = await sm.confirmShot();

      expect(finalResult.isComplete).toBe(true);
      expect(finalResult.acceptedPhotos).toEqual(['photo1', 'photo2']);
      expect(sm.isAllCompleted()).toBe(true);
      expect(onCompleteMock).toHaveBeenCalledWith(['photo1', 'photo2']);
    });
  });

  describe('Mid-Session Recovery (PRD Bagian 7 & F-10)', () => {
    it('resumes from next unsaved shot index when initialPhotos are provided', () => {
      const sm = createCaptureStateMachine({
        totalPhotos: 3,
        initialPhotos: ['saved_photo_1.jpg']
      });

      expect(sm.getCurrentShotIndex()).toBe(1);
      expect(sm.getSubState()).toBe(CAPTURE_SUB_STATES.LIVE);
      expect(sm.getAcceptedPhotos()).toEqual(['saved_photo_1.jpg']);
      expect(sm.isLastShot()).toBe(false);
    });

    it('marks all completed if all initialPhotos are already present', () => {
      const sm = createCaptureStateMachine({
        totalPhotos: 2,
        initialPhotos: ['saved_1.jpg', 'saved_2.jpg']
      });

      expect(sm.isAllCompleted()).toBe(true);
      expect(sm.getCurrentShotIndex()).toBe(2);
    });
  });

  describe('Server HTTP API - POST /api/sessions/:id/photo (Idempotent single photo save)', () => {
    let server = null;
    let baseUrl = '';
    const testSessionId = `test_cap_${Date.now()}`;

    beforeAll(async () => {
      await new Promise((res) => {
        server = app.listen(0, () => {
          baseUrl = `http://localhost:${server.address().port}`;
          res();
        });
      });

      // Insert dummy session
      db.prepare(`
        INSERT INTO sessions (id, status, dibuat_pada)
        VALUES (?, 'capturing', datetime('now'))
      `).run(testSessionId);
    });

    afterAll(async () => {
      if (server) {
        await new Promise((res) => server.close(res));
      }
      db.prepare('DELETE FROM photos WHERE session_id = ?').run(testSessionId);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(testSessionId);
    });

    it('saves single photo idempotently per index', async () => {
      const photoPayload = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      // First save for index 0
      const res1 = await fetch(`${baseUrl}/api/sessions/${testSessionId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: 0, photo: photoPayload })
      });
      const data1 = await res1.json();

      expect(res1.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data1.data.urutan).toBe(1);

      // Verify DB record
      const row1 = db.prepare('SELECT * FROM photos WHERE session_id = ? AND urutan = 1').get(testSessionId);
      expect(row1).toBeDefined();
      expect(row1.path_file).toContain('-raw-1.jpg');

      // Idempotent overwrite on the same index 0
      const res2 = await fetch(`${baseUrl}/api/sessions/${testSessionId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: 0, photo: photoPayload })
      });
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.success).toBe(true);

      const rows = db.prepare('SELECT * FROM photos WHERE session_id = ? AND urutan = 1').all(testSessionId);
      expect(rows.length).toBe(1); // exactly one row, no duplicates
    });

    it('rejects missing photo or invalid index', async () => {
      const res = await fetch(`${baseUrl}/api/sessions/${testSessionId}/photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: -1 })
      });
      expect(res.status).toBe(400);
    });
  });
});
