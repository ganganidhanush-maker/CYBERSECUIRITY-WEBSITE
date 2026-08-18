import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatCsvValue } from '../src/lib/export-csv.js'

describe('Universal CSV Export & Data Formatting System', () => {
  it('formats null, undefined, and empty values strictly as "---"', () => {
    assert.equal(formatCsvValue(null), '---')
    assert.equal(formatCsvValue(undefined), '---')
    assert.equal(formatCsvValue(''), '---')
    assert.equal(formatCsvValue('   '), '---')
    assert.equal(formatCsvValue('null'), '---')
    assert.equal(formatCsvValue('undefined'), '---')
  })

  it('preserves valid strings, numbers, and booleans', () => {
    assert.equal(formatCsvValue('23MR01A0501'), '23MR01A0501')
    assert.equal(formatCsvValue(150), '150')
    assert.equal(formatCsvValue(0), '0')
    assert.equal(formatCsvValue(true), 'true')
  })

  it('escapes and quotes values containing commas, newlines, or quotes', () => {
    assert.equal(formatCsvValue('CSE, AIML'), '"CSE, AIML"')
    assert.equal(formatCsvValue('Hello\nWorld'), '"Hello\nWorld"')
    assert.equal(formatCsvValue('Cyber "CTF" Lead'), '"Cyber ""CTF"" Lead"')
  })

  it('formats member roster row with missing fields replaced by "---"', () => {
    const member = {
      memberId: '23MR01A0501',
      name: 'John Doe',
      role: 'STUDENT',
      rollNumber: null, // missing -> '---'
      department: 'CSE',
      year: undefined, // missing -> '---'
      email: '', // missing -> '---'
      phone: '+919876543210',
      accountStatus: 'ACTIVE',
      twoFactorEnabled: false,
      createdAt: null, // missing -> '---'
    }

    const row = [
      member.memberId,
      member.name,
      member.role,
      member.rollNumber,
      member.department,
      member.year,
      member.email,
      member.phone,
      member.accountStatus,
      member.twoFactorEnabled ? 'Enabled' : 'Disabled',
      member.createdAt ? new Date(member.createdAt).toLocaleDateString() : null,
    ].map(formatCsvValue)

    assert.deepEqual(row, [
      '23MR01A0501',
      'John Doe',
      'STUDENT',
      '---',
      'CSE',
      '---',
      '---',
      '+919876543210',
      'ACTIVE',
      'Disabled',
      '---',
    ])
  })

  it('formats leadership directory row with missing fields replaced by "---"', () => {
    const leader = {
      name: 'Jane Smith',
      roleTitle: 'President',
      collegeEmail: 'jane@mrdu.edu',
      bio: null, // missing -> '---'
      linkedinUrl: undefined, // missing -> '---'
      githubUrl: 'https://github.com/janesmith',
      instagramUrl: '', // missing -> '---'
    }

    const row = [
      1,
      leader.name,
      leader.roleTitle,
      leader.collegeEmail,
      leader.bio,
      leader.linkedinUrl,
      leader.githubUrl,
      leader.instagramUrl,
    ].map(formatCsvValue)

    assert.deepEqual(row, [
      '1',
      'Jane Smith',
      'President',
      'jane@mrdu.edu',
      '---',
      '---',
      'https://github.com/janesmith',
      '---',
    ])
  })
})
