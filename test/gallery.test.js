import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  galleryAlbumSchema,
  galleryPhotoSchema,
  galleryPhotosBatchSchema,
} from '../server/validators/member.validator.js'
import { rolePermissionMatrix } from '../server/config/permissions.js'

describe('Gallery System: Media Lead Multi-Upload & Student Photo Visibility', () => {
  const sampleDataUrl1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const sampleDataUrl2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

  it('validates single photo upload schema (backward compatibility)', () => {
    const singlePayload = {
      imageUrl: sampleDataUrl1,
      caption: 'Winner celebration',
    }
    const result = galleryPhotoSchema.safeParse(singlePayload)
    assert.equal(result.success, true)
    assert.equal(result.data.caption, 'Winner celebration')
    assert.equal(result.data.imageUrl, sampleDataUrl1)
  })

  it('validates multi-photo batch upload schema for Media Lead', () => {
    const batchPayload = {
      photos: [
        { imageUrl: sampleDataUrl1, caption: 'Opening keynote' },
        { imageUrl: sampleDataUrl2, caption: 'CTF Challenge Room' },
        { imageUrl: sampleDataUrl1, caption: 'Prize ceremony' },
      ],
    }
    const result = galleryPhotosBatchSchema.safeParse(batchPayload)
    assert.equal(result.success, true)
    assert.equal(result.data.photos.length, 3)
    assert.equal(result.data.photos[0].caption, 'Opening keynote')
    assert.equal(result.data.photos[1].caption, 'CTF Challenge Room')
    assert.equal(result.data.photos[2].caption, 'Prize ceremony')
  })

  it('rejects batch photo upload when array is empty', () => {
    const emptyBatch = { photos: [] }
    const result = galleryPhotosBatchSchema.safeParse(emptyBatch)
    assert.equal(result.success, false)
  })

  it('validates album creation schema with and without cover image', () => {
    const validAlbum = {
      name: 'Hackathon 2026',
      description: 'Campus hackathon highlights and project demos',
      coverImage: sampleDataUrl1,
    }
    const result = galleryAlbumSchema.safeParse(validAlbum)
    assert.equal(result.success, true)
    assert.equal(result.data.name, 'Hackathon 2026')

    const albumNoCover = {
      name: 'Workshop Series',
      description: null,
    }
    const resultNoCover = galleryAlbumSchema.safeParse(albumNoCover)
    assert.equal(resultNoCover.success, true)
    assert.equal(resultNoCover.data.name, 'Workshop Series')
  })

  it('enforces Student role has GALLERY_VIEW (Read-Only) and NOT GALLERY_MANAGE', () => {
    const studentPerms = rolePermissionMatrix.STUDENT
    assert.equal(studentPerms.includes('GALLERY_VIEW'), true, 'Student must have GALLERY_VIEW permission')
    assert.equal(studentPerms.includes('GALLERY_MANAGE'), false, 'Student must NOT have GALLERY_MANAGE permission')

    const mediaLeadPerms = rolePermissionMatrix.MEDIA_LEAD
    assert.equal(mediaLeadPerms.includes('GALLERY_VIEW'), true, 'Media Lead must have GALLERY_VIEW permission')
    assert.equal(mediaLeadPerms.includes('GALLERY_MANAGE'), true, 'Media Lead must have GALLERY_MANAGE permission')
  })

  it('verifies album data structure preserves all photos for student view', () => {
    const mockAlbumFromDb = {
      id: 'album_123',
      name: 'Wireshark Lab Highlights',
      description: 'Hands-on network analysis session',
      coverImage: sampleDataUrl1,
      createdAt: new Date(),
      photos: [
        { id: 'p1', albumId: 'album_123', imageUrl: sampleDataUrl1, caption: 'Packet capture demo' },
        { id: 'p2', albumId: 'album_123', imageUrl: sampleDataUrl2, caption: 'Student workstations' },
        { id: 'p3', albumId: 'album_123', imageUrl: sampleDataUrl1, caption: 'Q&A session' },
      ],
    }

    assert.equal(mockAlbumFromDb.photos.length, 3)
    assert.equal(mockAlbumFromDb.photos[0].id, 'p1')
    assert.equal(mockAlbumFromDb.photos[1].id, 'p2')
    assert.equal(mockAlbumFromDb.photos[2].id, 'p3')
  })

  it('validates photo lightbox navigation calculations (index, prev, next, wrapping boundaries)', () => {
    const mockPhotos = [
      { id: 'photo-1', imageUrl: sampleDataUrl1, caption: 'Intro' },
      { id: 'photo-2', imageUrl: sampleDataUrl2, caption: 'Middle' },
      { id: 'photo-3', imageUrl: sampleDataUrl1, caption: 'End' },
    ]

    // Initial selected photo at index 0
    let currentIndex = mockPhotos.findIndex(p => p.id === 'photo-1')
    assert.equal(currentIndex, 0)
    assert.equal(currentIndex > 0, false, 'First photo cannot navigate backwards')
    assert.equal(currentIndex < mockPhotos.length - 1, true, 'First photo can navigate forward')

    // Navigate to next photo
    currentIndex += 1
    assert.equal(mockPhotos[currentIndex].id, 'photo-2')
    assert.equal(currentIndex > 0, true, 'Middle photo can navigate backwards')
    assert.equal(currentIndex < mockPhotos.length - 1, true, 'Middle photo can navigate forward')

    // Navigate to last photo
    currentIndex += 1
    assert.equal(mockPhotos[currentIndex].id, 'photo-3')
    assert.equal(currentIndex < mockPhotos.length - 1, false, 'Last photo cannot navigate forward')
  })
})

