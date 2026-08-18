import { prisma } from '../db/prisma.js'

async function seed() {
  console.log('Seeding Onboarding Video Settings, Gallery Albums, and Leader Priority...')

  // 1. Enable Intro Video & Set Default Cybersecurity Video
  await prisma.clubSetting.upsert({
    where: { key: 'introVideoEnabled' },
    create: { key: 'introVideoEnabled', value: 'true' },
    update: { value: 'true' },
  })

  await prisma.clubSetting.upsert({
    where: { key: 'onboardingBriefingMode' },
    create: { key: 'onboardingBriefingMode', value: 'VIDEO' },
    update: { value: 'VIDEO' },
  })

  await prisma.clubSetting.upsert({
    where: { key: 'introBriefingMode' },
    create: { key: 'introBriefingMode', value: 'VIDEO' },
    update: { value: 'VIDEO' },
  })

  await prisma.clubSetting.upsert({
    where: { key: 'introVideoRequireTwoMinutes' },
    create: { key: 'introVideoRequireTwoMinutes', value: 'true' },
    update: { value: 'true' },
  })

  await prisma.clubSetting.upsert({
    where: { key: 'introVideoUrl' },
    create: { key: 'introVideoUrl', value: 'https://www.youtube.com/watch?v=inWWhr5tnEA' },
    update: { value: 'https://www.youtube.com/watch?v=inWWhr5tnEA' },
  })

  // 2. Create Gallery Albums with High-Quality Cybersecurity Photos
  const existingAlbums = await prisma.galleryAlbum.findMany()
  if (existingAlbums.length === 0) {
    const album1 = await prisma.galleryAlbum.create({
      data: {
        id: 'album-ctf-2026',
        name: 'National Cyber CTF Hackathon 2026',
        description: '48-hour live ethical hacking, binary exploitation, and reverse engineering challenge.',
        coverImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
        photos: {
          create: [
            {
              id: 'photo-ctf-1',
              imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
              caption: 'Live Flag Submission & Cyber Command Center Dashboard',
              createdAt: new Date('2026-03-01T10:00:00Z'),
            },
            {
              id: 'photo-ctf-2',
              imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
              caption: 'Binary Analysis and Cryptographic Cipher Cracking Round',
              createdAt: new Date('2026-03-01T14:30:00Z'),
            },
            {
              id: 'photo-ctf-3',
              imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
              caption: 'Finalists Team Collaboration in Deep Network Defense',
              createdAt: new Date('2026-03-02T18:00:00Z'),
            },
          ],
        },
      },
    })

    const album2 = await prisma.galleryAlbum.create({
      data: {
        id: 'album-bootcamp-2026',
        name: 'Ethical Hacking & Defense Bootcamp',
        description: 'Hands-on malware analysis, SOC incident response, and web security laboratories.',
        coverImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
        photos: {
          create: [
            {
              id: 'photo-boot-1',
              imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
              caption: 'Hands-on Sandbox Penetration Testing Workshop',
              createdAt: new Date('2026-02-10T09:00:00Z'),
            },
            {
              id: 'photo-boot-2',
              imageUrl: 'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=1200&q=80',
              caption: 'Network Forensics and Wireshark Packet Inspection Lab',
              createdAt: new Date('2026-02-11T16:00:00Z'),
            },
          ],
        },
      },
    })
    console.log('Created albums:', album1.id, album2.id)
  }

  // 3. Ensure Leaders have proper sortOrder
  const leaders = await prisma.clubTeamMember.findMany({ orderBy: { createdAt: 'asc' } })
  for (let i = 0; i < leaders.length; i++) {
    await prisma.clubTeamMember.update({
      where: { id: leaders[i].id },
      data: { sortOrder: i + 1 },
    })
  }

  console.log('Seed completed successfully.')
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
