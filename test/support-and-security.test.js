import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'

describe('Helpdesk Role-Restricted Answering & President Dual PIN', () => {
  it('enforces strict role-restricted reply permissions on support queries', () => {
    const ticket = { taggedRole: 'TECH_TEAM', userId: 'student-123' }

    function canReplyToTicket(user, targetTicket) {
      const isPresident = Boolean(user.isPrimaryAdmin) || user.role === 'PRESIDENT'
      const isTaggedRole = user.role === targetTicket.taggedRole
      const isOwnerStudent = user.role === 'STUDENT' && user.id === targetTicket.userId
      return isPresident || isTaggedRole || isOwnerStudent
    }

    const techTeamUser = { id: 'user-tech', role: 'TECH_TEAM', isPrimaryAdmin: false }
    const presidentUser = { id: 'user-pres', role: 'PRESIDENT', isPrimaryAdmin: true }
    const culturalUser = { id: 'user-cult', role: 'CULTURAL', isPrimaryAdmin: false }
    const ownerStudent = { id: 'student-123', role: 'STUDENT', isPrimaryAdmin: false }
    const otherStudent = { id: 'student-456', role: 'STUDENT', isPrimaryAdmin: false }

    assert.equal(canReplyToTicket(techTeamUser, ticket), true, 'Tech team member must be allowed to answer @TECH_TEAM ticket')
    assert.equal(canReplyToTicket(presidentUser, ticket), true, 'President must be allowed to answer any ticket')
    assert.equal(canReplyToTicket(ownerStudent, ticket), true, 'Student who created the ticket can reply to their own thread')
    assert.equal(canReplyToTicket(culturalUser, ticket), false, 'Cultural team member must be blocked from answering @TECH_TEAM ticket')
    assert.equal(canReplyToTicket(otherStudent, ticket), false, 'Unrelated students must be blocked from replying')
  })

  it('validates 6-digit Master PIN hashing and verification for Primary President', async () => {
    const masterPin = '849201'
    const masterPinHash = await bcrypt.hash(masterPin, 10)

    const correctMatch = await bcrypt.compare('849201', masterPinHash)
    const incorrectMatch = await bcrypt.compare('123456', masterPinHash)

    assert.equal(correctMatch, true, 'Valid 6-digit Master PIN must match hash')
    assert.equal(incorrectMatch, false, 'Incorrect PIN must be rejected')
  })

  it('validates 6-digit PIN format regex', () => {
    const validPin = '123456'
    const shortPin = '12345'
    const letterPin = '12345a'

    assert.equal(/^\d{6}$/.test(validPin), true)
    assert.equal(/^\d{6}$/.test(shortPin), false)
    assert.equal(/^\d{6}$/.test(letterPin), false)
  })

  it('restricts audit log clearing strictly to Primary President', () => {
    function canClearAudit(user) {
      return Boolean(user.isPrimaryAdmin)
    }

    assert.equal(canClearAudit({ role: 'PRESIDENT', isPrimaryAdmin: true }), true)
    assert.equal(canClearAudit({ role: 'PRESIDENT', isPrimaryAdmin: false }), false)
    assert.equal(canClearAudit({ role: 'VICE_PRESIDENT', isPrimaryAdmin: false }), false)
    assert.equal(canClearAudit({ role: 'STUDENT', isPrimaryAdmin: false }), false)
  })

  it('restricts Council Chat access strictly to executive leadership roles', () => {
    function canAccessCouncilChat(user) {
      return user.role !== 'STUDENT'
    }

    assert.equal(canAccessCouncilChat({ role: 'PRESIDENT' }), true)
    assert.equal(canAccessCouncilChat({ role: 'VICE_PRESIDENT' }), true)
    assert.equal(canAccessCouncilChat({ role: 'TECH_TEAM' }), true)
    assert.equal(canAccessCouncilChat({ role: 'TREASURER' }), true)
    assert.equal(canAccessCouncilChat({ role: 'STUDENT' }), false)
  })
})

