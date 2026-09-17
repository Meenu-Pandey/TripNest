/**
 * Phase 8: Memories & Photos — End-to-End Vertical Slice Integration Verification
 *
 * Exercises the entire Memories & Photos lifecycle against real PostgreSQL
 * and LocalDiskStorage:
 *   1. User registration (Owner, Member, Viewer, Stranger)
 *   2. Trip creation (starts in PLANNING status)
 *   3. Member additions (MEMBER and VIEWER)
 *   4. Place creation for memory association
 *   5. Upload to uncompleted trip rejection (409 Conflict)
 *   6. Non-owner trip completion rejection (403 Forbidden)
 *   7. Trip OWNER marks trip COMPLETED (200 OK)
 *   8. VIEWER upload rejection (403 Forbidden)
 *   9. Invalid MIME type file rejection (400 Bad Request)
 *  10. Member photo upload with caption and place association (201 Created)
 *  11. Physical storage persistence verification on disk
 *  12. Static file serving check via returned URL (200 OK)
 *  13. Member second photo upload (201 Created)
 *  14. Per-member quota enforcement (max 2 favorite photos) (409 Conflict)
 *  15. Memory listing with pagination and place association
 *  16. Unauthorized delete rejection (403 Forbidden)
 *  17. Uploader deletes own photo (200 OK) and storage unlinking
 *  18. Owner deletes any photo (200 OK)
 *  19. IDOR protection: non-member cannot view or upload (404 Not Found)
 *  20. Clean database and storage cleanup
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '@/app';
import { env } from '@/config/env';
import { prisma } from '@/lib/prisma';

const app = createApp();

const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const FAKE_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

async function resetDatabase(): Promise<void> {
  await prisma.memoryPhoto.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.budgetCategory.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.place.deleteMany();
  await prisma.tripInvite.deleteMany();
  await prisma.tripMember.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(email: string, name: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePassword123!', name });
  expect(res.status).toBe(201);
  return {
    token: res.body.data.token as string,
    user: res.body.data.user as { id: string; email: string; name: string },
  };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('Phase 8: Memories & Photos Vertical Slice Contract', () => {
  it('executes the complete Memories & Photos lifecycle against real PostgreSQL and LocalDiskStorage', async () => {
    // 1. Setup users
    const alice = await registerUser('alice.phase8@example.com', 'Alice Owner');
    const bob = await registerUser('bob.phase8@example.com', 'Bob Member');
    const charlie = await registerUser('charlie.phase8@example.com', 'Charlie Viewer');
    const stranger = await registerUser('stranger.phase8@example.com', 'Stranger NonMember');

    // 2. Alice creates a trip (defaults to PLANNING status)
    const tripRes = await request(app)
      .post('/api/v1/trips')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        name: 'Himalayan Ridge Expedition',
        destination: 'Manali, India',
        startDate: '2026-10-01',
        endDate: '2026-10-10',
        currency: 'INR',
      });
    expect(tripRes.status).toBe(201);
    const tripId = tripRes.body.data.trip.id as string;
    expect(tripRes.body.data.trip.status).toBe('PLANNING');

    // 3. Setup memberships
    await prisma.tripMember.create({
      data: { tripId, userId: bob.user.id, role: 'MEMBER' },
    });
    await prisma.tripMember.create({
      data: { tripId, userId: charlie.user.id, role: 'VIEWER' },
    });

    // 4. Create a place for photo association
    const placeRes = await request(app)
      .post(`/api/v1/trips/${tripId}/places`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({
        name: 'Rohtang Pass Summit',
        address: 'Rohtang Pass, Himachal Pradesh',
        latitude: 32.3716,
        longitude: 77.2466,
        category: 'NATURE',
      });
    expect(placeRes.status).toBe(201);
    const placeId = placeRes.body.data.place.id as string;

    // 5. Upload to uncompleted trip is rejected (409 Conflict)
    const uncompletedUploadRes = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${bob.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'early.jpg', contentType: 'image/jpeg' });
    expect(uncompletedUploadRes.status).toBe(409);
    expect(uncompletedUploadRes.body.error.message).toContain('completed trip');

    // 6. Non-owner cannot mark trip COMPLETED (403 Forbidden)
    const bobCompleteRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobCompleteRes.status).toBe(403);

    // 7. Owner marks trip COMPLETED (200 OK)
    const completeRes = await request(app)
      .patch(`/api/v1/trips/${tripId}/complete`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.trip.status).toBe('COMPLETED');

    // 8. VIEWER cannot upload memory photo (403 Forbidden)
    const viewerUploadRes = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${charlie.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'viewer.jpg', contentType: 'image/jpeg' });
    expect(viewerUploadRes.status).toBe(403);
    expect(viewerUploadRes.body.error.message).toContain('Viewers cannot add');

    // 9. Invalid file type rejection (400 Bad Request)
    const badFileRes = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${bob.token}`)
      .attach('photo', Buffer.from('PDF content'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });
    expect(badFileRes.status).toBe(400);
    expect(badFileRes.body.error.message).toContain('Unsupported file type');

    // 10. Valid photo upload with caption and place association (201 Created)
    const upload1Res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${bob.token}`)
      .field('caption', 'Snowy summit at Rohtang Pass')
      .field('placeId', placeId)
      .attach('photo', FAKE_JPEG, { filename: 'summit.jpg', contentType: 'image/jpeg' });

    expect(upload1Res.status).toBe(201);
    const photo1 = upload1Res.body.data.memory;
    expect(photo1.id).toBeDefined();
    expect(photo1.caption).toBe('Snowy summit at Rohtang Pass');
    expect(photo1.placeId).toBe(placeId);
    expect(photo1.uploadedBy.userId).toBe(bob.user.id);
    expect(photo1.uploadedBy.name).toBe('Bob Member');
    expect(photo1.url).toMatch(/^\/uploads\/memories\//);

    // 11. Verify physical file persistence on local disk
    const relativeStorageKey = photo1.url.replace(/^\/uploads\//, '');
    const physicalPath = path.resolve(env.UPLOADS_DIR, relativeStorageKey);
    const fileStat = await fs.stat(physicalPath);
    expect(fileStat.size).toBe(FAKE_JPEG.length);

    // 12. Verify file is servable via HTTP through static route
    const fileServeRes = await request(app).get(photo1.url);
    expect(fileServeRes.status).toBe(200);

    // 13. Bob uploads second photo (201 Created)
    const upload2Res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${bob.token}`)
      .field('caption', 'Campfire evening')
      .attach('photo', FAKE_PNG, { filename: 'camp.png', contentType: 'image/png' });

    expect(upload2Res.status).toBe(201);
    const photo2 = upload2Res.body.data.memory;
    expect(photo2.caption).toBe('Campfire evening');

    // 14. Bob attempts third photo (Exceeds max 2 photos per member quota) (409 Conflict)
    const upload3Res = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${bob.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'third.jpg', contentType: 'image/jpeg' });
    expect(upload3Res.status).toBe(409);
    expect(upload3Res.body.error.message).toContain('at most 2 favorite photos');

    // 15. List memories with pagination (200 OK)
    const listRes = await request(app)
      .get(`/api/v1/trips/${tripId}/memories?page=1&pageSize=10`)
      .set('Authorization', `Bearer ${charlie.token}`); // Viewer can read
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.memories).toHaveLength(2);
    expect(listRes.body.data.pagination.total).toBe(2);
    // Reverse chronological order
    expect(listRes.body.data.memories[0].id).toBe(photo2.id);
    expect(listRes.body.data.memories[1].id).toBe(photo1.id);

    // 16. Alice (not uploader) cannot delete Bob's photo if she were just a member,
    // but Alice is OWNER so she CAN delete. Let's verify Bob cannot delete Alice's photo:
    const alicePhotoRes = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${alice.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'alice.jpg', contentType: 'image/jpeg' });
    expect(alicePhotoRes.status).toBe(201);
    const alicePhoto = alicePhotoRes.body.data.memory;

    const bobDeleteAliceRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/memories/${alicePhoto.id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobDeleteAliceRes.status).toBe(403);
    expect(bobDeleteAliceRes.body.error.message).toContain('Only the uploader or the trip owner');

    // 17. Bob deletes his own photo1 (200 OK)
    const bobDeleteRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/memories/${photo1.id}`)
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobDeleteRes.status).toBe(200);
    expect(bobDeleteRes.body.data.id).toBe(photo1.id);

    // Verify row removed from DB
    const dbPhoto1 = await prisma.memoryPhoto.findUnique({ where: { id: photo1.id } });
    expect(dbPhoto1).toBeNull();

    // Verify file unlinked from disk
    await expect(fs.stat(physicalPath)).rejects.toThrow();

    // 18. Owner (Alice) deletes Bob's photo2 (200 OK)
    const ownerDeleteBobRes = await request(app)
      .delete(`/api/v1/trips/${tripId}/memories/${photo2.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(ownerDeleteBobRes.status).toBe(200);

    // 19. IDOR: Stranger cannot access memories or upload to this trip
    const strangerListRes = await request(app)
      .get(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerListRes.status).toBe(404);

    const strangerUploadRes = await request(app)
      .post(`/api/v1/trips/${tripId}/memories`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .attach('photo', FAKE_JPEG, { filename: 'stranger.jpg', contentType: 'image/jpeg' });
    expect(strangerUploadRes.status).toBe(404);
  });
});
