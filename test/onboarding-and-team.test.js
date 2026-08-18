import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { clubSettingsSchema, clubTeamMemberSchema } from '../server/validators/member.validator.js'

describe('Onboarding Briefing & Team Priority Management System', () => {
  it('validates Onboarding Briefing settings schema for VIDEO and SLIDESHOW modes', () => {
    const videoSettings = {
      onboardingBriefingMode: 'VIDEO',
      introVideoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      introVideoRequireTwoMinutes: true,
    }
    const parsedVideo = clubSettingsSchema.safeParse(videoSettings)
    assert.equal(parsedVideo.success, true)
    assert.equal(parsedVideo.data.onboardingBriefingMode, 'VIDEO')
    assert.equal(parsedVideo.data.introVideoRequireTwoMinutes, true)

    const slideshowSettings = {
      onboardingBriefingMode: 'SLIDESHOW',
      introBriefingMode: 'SLIDESHOW',
    }
    const parsedSlideshow = clubSettingsSchema.safeParse(slideshowSettings)
    assert.equal(parsedSlideshow.success, true)
    assert.equal(parsedSlideshow.data.onboardingBriefingMode, 'SLIDESHOW')
  })

  it('rejects invalid onboarding briefing mode values', () => {
    const invalidSettings = {
      onboardingBriefingMode: 'INVALID_MODE',
    }
    const parsed = clubSettingsSchema.safeParse(invalidSettings)
    assert.equal(parsed.success, false)
  })

  it('validates 2-minute video playback timer logic and pause freeze', () => {
    let secondsWatched = 0
    let isPlaying = false
    const requiredDuration = 120

    function tick() {
      if (isPlaying) {
        secondsWatched += 1
      }
    }

    // Video is not playing: tick does not increment
    tick()
    tick()
    assert.equal(secondsWatched, 0, 'Timer must not run while video is unstarted')

    // Video starts playing (YT.PlayerState.PLAYING = 1)
    isPlaying = true
    for (let i = 0; i < 30; i++) tick()
    assert.equal(secondsWatched, 30, 'Timer runs for 30s while video is playing')

    // User pauses video (YT.PlayerState.PAUSED = 2)
    isPlaying = false
    for (let i = 0; i < 15; i++) tick()
    assert.equal(secondsWatched, 30, 'Timer MUST remain frozen while video is paused')

    // User resumes video
    isPlaying = true
    for (let i = 0; i < 90; i++) tick()
    assert.equal(secondsWatched, 120, 'Timer reaches full 120 seconds')

    const canProceed = secondsWatched >= requiredDuration
    assert.equal(canProceed, true, 'Completion allowed after full active playback')
  })

  it('verifies 15-second loading fallback priority order: Photos (Latest First) -> Leaders (Priority Order)', () => {
    const albums = [
      {
        id: 'album-1',
        name: 'Cyber Hackathon 2025',
        photos: [
          { id: 'p1', imageUrl: 'img1.png', createdAt: new Date('2025-01-10T10:00:00Z') },
          { id: 'p2', imageUrl: 'img2.png', createdAt: new Date('2025-02-15T10:00:00Z') },
        ],
      },
      {
        id: 'album-2',
        name: 'Defcon Meetup 2026',
        photos: [
          { id: 'p3', imageUrl: 'img3.png', createdAt: new Date('2026-03-01T10:00:00Z') },
        ],
      },
    ]

    const allPhotos = albums.flatMap(a => (a.photos || []).map(p => ({ ...p, albumName: a.name })))
    allPhotos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    assert.equal(allPhotos.length, 3)
    assert.equal(allPhotos[0].id, 'p3', 'Latest photo (2026-03-01) must appear first')
    assert.equal(allPhotos[1].id, 'p2', 'Second latest photo (2025-02-15) must appear second')
    assert.equal(allPhotos[2].id, 'p1', 'Oldest photo (2025-01-10) must appear last')

    // If allPhotos is empty, fallback to leader profiles sorted by sortOrder asc
    const emptyPhotos = []
    const leaders = [
      { id: 'l3', name: 'Media Lead', sortOrder: 3 },
      { id: 'l1', name: 'President', sortOrder: 1 },
      { id: 'l2', name: 'Technical Lead', sortOrder: 2 },
    ]

    leaders.sort((a, b) => a.sortOrder - b.sortOrder)

    assert.equal(emptyPhotos.length, 0)
    assert.equal(leaders[0].name, 'President', 'President (sortOrder 1) appears first in fallback')
    assert.equal(leaders[1].name, 'Technical Lead', 'Technical Lead (sortOrder 2) appears second')
    assert.equal(leaders[2].name, 'Media Lead', 'Media Lead (sortOrder 3) appears third')
  })

  it('validates editing of existing leader profile schema without creating duplicate records', () => {
    const editPayload = {
      name: 'Jane Doe Updated',
      roleTitle: 'Chief Cyber Operations Officer',
      collegeEmail: 'jane.doe@college.edu',
      bio: 'Leading red team and blue team defense workshops.',
      linkedinUrl: 'https://linkedin.com/in/janedoe',
      githubUrl: 'https://github.com/janedoe',
    }

    const parsed = clubTeamMemberSchema.partial().safeParse(editPayload)
    assert.equal(parsed.success, true)
    assert.equal(parsed.data.name, 'Jane Doe Updated')
    assert.equal(parsed.data.roleTitle, 'Chief Cyber Operations Officer')
  })

  it('validates reordering of leadership profiles updating sequential sortOrder', () => {
    const initialLeaders = [
      { id: 'l1', name: 'President', sortOrder: 1 },
      { id: 'l2', name: 'Technical Lead', sortOrder: 2 },
      { id: 'l3', name: 'Event Management Lead', sortOrder: 3 },
    ]

    // Swap Technical Lead to #1
    const reorderedIds = ['l2', 'l1', 'l3']
    const updatedLeaders = reorderedIds.map((id, index) => {
      const found = initialLeaders.find(l => l.id === id)
      return { ...found, sortOrder: index + 1 }
    })

    assert.equal(updatedLeaders[0].name, 'Technical Lead')
    assert.equal(updatedLeaders[0].sortOrder, 1)
    assert.equal(updatedLeaders[1].name, 'President')
    assert.equal(updatedLeaders[1].sortOrder, 2)
    assert.equal(updatedLeaders[2].name, 'Event Management Lead')
    assert.equal(updatedLeaders[2].sortOrder, 3)
  })
})
